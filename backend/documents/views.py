import os
import uuid
import re

from django.conf import settings
from django.http import FileResponse, Http404

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from docx import Document as DocxDocument
from pypdf import PdfReader
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from html import escape

from .models import DocumentUpload, DocumentTemplate
from .serializers import DocumentUploadSerializer, DocumentTemplateSerializer
from translation.views import TranslationService
from history.utils import save_to_history


# ═════════════════════════════════════════════════════════════
# HELPER: TEXT CLEANING (PREVENTS 5-PAGE BLANK EXPLOSION)
# ═════════════════════════════════════════════════════════════

def clean_extracted_text(text):
    """
    Aggressively cleans PDF extraction artifacts. 
    Joins all lines with a single space to prevent the 
    "1 page becomes 5 blank pages" issue caused by hidden newlines.
    """
    if not text:
        return ""
    
    # 1. Remove all invisible control characters
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
    
    # 2. Normalize all newlines to \n
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    
    # 3. CRITICAL FIX: Split by newline, strip each line, and keep ONLY non-empty lines
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # 4. Join with a SINGLE SPACE. 
    # This forces the PDF generator to word-wrap naturally instead of creating blank pages.
    result = " ".join(lines)
    
    # 5. Clean up any accidental double spaces
    return re.sub(r' +', ' ', result).strip()


# ═════════════════════════════════════════════════════════════
# TEXT EXTRACTION & OUTPUT CREATION
# ═════════════════════════════════════════════════════════════

class DocumentProcessor:
    @staticmethod
    def extract_text(file_path, file_type):
        if file_type in ["txt", "md", "rtf"]:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as file:
                return clean_extracted_text(file.read())

        elif file_type == "docx":
            document = DocxDocument(file_path)
            paragraphs = [paragraph.text for paragraph in document.paragraphs if paragraph.text.strip()]
            return clean_extracted_text("\n\n".join(paragraphs))

        elif file_type == "pdf":
            reader = PdfReader(file_path)
            text_parts = []
            for page in reader.pages:
                try:
                    page_text = page.extract_text() or ""
                except Exception:
                    page_text = ""
                
                if page_text.strip():
                    text_parts.append(clean_extracted_text(page_text))
            
            return "\n\n".join(text_parts)

        elif file_type == "html":
            from html.parser import HTMLParser
            class MLStripper(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.fed = []
                def handle_data(self, data):
                    if data.strip():
                        self.fed.append(data.strip())
                def get_data(self):
                    return " ".join(self.fed)

            with open(file_path, "r", encoding="utf-8", errors="ignore") as file:
                parser = MLStripper()
                parser.feed(file.read())
                return clean_extracted_text(parser.get_data())

        raise ValueError(f"Unsupported file type: {file_type}")

    @staticmethod
    def create_output(text, output_format, output_path, original_name):
        # Final aggressive cleaning right before generation
        text = clean_extracted_text(text)

        if output_format == "txt":
            with open(output_path, "w", encoding="utf-8") as file:
                file.write(text)
            return output_path

        elif output_format == "docx":
            document = DocxDocument()
            document.add_paragraph(text)
            document.save(output_path)
            return output_path

        elif output_format == "pdf":
            try:
                from fpdf import FPDF
                pdf = FPDF()
                pdf.add_page()
                
                font_paths = [
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
                    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
                ]
                
                font_loaded = False
                for font_path in font_paths:
                    if os.path.exists(font_path):
                        try:
                            pdf.add_font('UnicodeFont', '', font_path, uni=True)
                            pdf.set_font('UnicodeFont', '', 11)
                            font_loaded = True
                            print(f"✅ FPDF2 successfully loaded: {font_path}")
                            break
                        except Exception as e:
                            print(f"⚠️ FPDF2 font error for {font_path}: {e}")
                            continue
                
                if not font_loaded:
                    print("⚠️ WARNING: No Unicode font found. Falling back to Helvetica.")
                    pdf.set_font('Helvetica', '', 11)
                
                # Since text is already cleaned into a continuous string with spaces,
                # multi_cell will word-wrap it perfectly without creating blank pages.
                pdf.multi_cell(0, 8, text)
                
                pdf.output(output_path)
                return output_path
                
            except ImportError:
                print("⚠️ FPDF2 not installed. Falling back to ReportLab.")
                document = SimpleDocTemplate(
                    output_path, pagesize=letter, rightMargin=45, leftMargin=45, topMargin=45, bottomMargin=45
                )
                
                font_paths = [
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
                ]
                
                font_found = False
                for font_path in font_paths:
                    if os.path.exists(font_path):
                        try:
                            pdfmetrics.registerFont(TTFont('UnicodeFont', font_path))
                            font_found = True
                            break
                        except Exception:
                            continue
                
                styles = getSampleStyleSheet()
                custom_style = ParagraphStyle(
                    name='UnicodeNormal',
                    parent=styles['Normal'],
                    fontName='UnicodeFont' if font_found else 'Helvetica',
                    fontSize=11,
                    leading=14,
                    wordWrap='CJK'
                )
                
                story = [Paragraph(escape(text), custom_style)]
                document.build(story)
                return output_path

        elif output_format == "html":
            html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{escape(original_name)}</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 20px; line-height: 1.7; color: #1e293b; white-space: pre-wrap;">
    <h1>{escape(original_name)}</h1>
    <p>{escape(text)}</p>
</body>
</html>"""
            with open(output_path, "w", encoding="utf-8") as file:
                file.write(html_content)
            return output_path

        raise ValueError(f"Unsupported output format: {output_format}")


# ═════════════════════════════════════════════════════════════
# DOCUMENT UPLOAD + TRANSLATION
# ═════════════════════════════════════════════════════════════

class DocumentUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if "file" not in request.FILES:
            return Response({"success": False, "message": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        uploaded_file = request.FILES["file"]
        file_type = self._detect_file_type(uploaded_file.name)

        if not file_type:
            return Response({"success": False, "message": "Unsupported file type."}, status=status.HTTP_400_BAD_REQUEST)

        max_file_size = getattr(settings, "MAX_DOCUMENT_UPLOAD_SIZE", 250 * 1024 * 1024)
        if uploaded_file.size > max_file_size:
            return Response({"success": False, "message": "File too large."}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        source_lang = request.data.get("source_lang", "auto") or "auto"
        target_lang = request.data.get("target_lang", "en") or "en"
        output_format = (request.data.get("output_format", "pdf") or "pdf").lower()
        
        if output_format not in {"txt", "docx", "pdf", "html"}:
            output_format = "pdf"

        doc = DocumentUpload.objects.create(
            user=user, original_file=uploaded_file, original_name=uploaded_file.name,
            file_type=file_type, file_size=uploaded_file.size, source_lang=source_lang,
            target_lang=target_lang, output_format=output_format, preserve_formatting=True,
        )

        try:
            self._process_document(doc)
        except Exception as exc:
            print(f"❌ Document processing error: {exc}")
            doc.mark_failed(str(exc))
            return Response({"success": False, "message": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"success": True, "message": "Document translated successfully.", "data": DocumentUploadSerializer(doc).data}, status=status.HTTP_200_OK)

    def _detect_file_type(self, filename):
        extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        return {"pdf": "pdf", "docx": "docx", "doc": "docx", "txt": "txt", "rtf": "rtf", "html": "html", "htm": "html", "md": "md"}.get(extension)

    def _process_document(self, doc):
        doc.mark_processing()
        extracted = DocumentProcessor.extract_text(doc.original_file.path, doc.file_type) or ""
        
        print(f"📊 Extracted text length: {len(extracted)} characters")
        
        if not extracted.strip():
            raise ValueError("No readable text found in the document.")

        doc.extracted_text = extracted[:10000]
        doc.page_count = max(1, (len(extracted) + 2999) // 3000)
        doc.save(update_fields=["extracted_text", "page_count"])

        print(f"🔄 Starting translation: {doc.source_lang} -> {doc.target_lang}")
        translated = self._translate_long_text(extracted, doc.source_lang, doc.target_lang)
        
        if not translated or not translated.strip():
            raise ValueError("Translation returned no text.")

        print(f"✅ Translation successful. Translated length: {len(translated)} characters")
        doc.translated_text_preview = translated[:2000]
        doc.save(update_fields=["translated_text_preview"])

        safe_name = re.sub(r"[^a-zA-Z0-9_\- ]+", "_", os.path.splitext(doc.original_name)[0]).strip() or "translated"
        output_path = os.path.join(settings.MEDIA_ROOT, "documents", str(doc.user.id), f"{uuid.uuid4().hex}.{doc.output_format}")
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        DocumentProcessor.create_output(translated, doc.output_format, output_path, doc.original_name)

        relative_path = os.path.relpath(output_path, settings.MEDIA_ROOT).replace("\\", "/")
        doc.mark_completed(relative_path, f"{safe_name}_translated.{doc.output_format}")

        try:
            save_to_history(
                user=doc.user, history_type="documents", title="Document Translation",
                description=f"Translated {doc.original_name}", source_app="documents",
                source_model="DocumentUpload", source_id=str(doc.id),
                metadata={"outputFormat": doc.output_format, "pages": doc.page_count, "size": doc.file_size, "output": doc.translated_name},
                output_file=relative_path, status="completed"
            )
        except Exception as e:
            print(f"❌ History save error: {e}")

    def _translate_long_text(self, text, source_lang, target_lang):
        if not text or not text.strip():
            return ""
        
        src = 'autodetect' if source_lang == 'auto' else source_lang
        max_chunk = 3500
        
        words = text.split(' ')
        chunks = []
        current_chunk = ""
        
        for word in words:
            if len(current_chunk) + len(word) + 1 <= max_chunk:
                current_chunk += (" " if current_chunk else "") + word
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = word
        
        if current_chunk:
            chunks.append(current_chunk)

        translated_chunks = []
        for i, chunk in enumerate(chunks):
            try:
                print(f"Translating chunk {i+1}/{len(chunks)} (Original Length: {len(chunk)})...")
                translated = TranslationService.translate(text=chunk, source_lang=src, target_lang=target_lang, mode="text-text")
                
                translated_str = str(translated).strip()
                print(f"DEBUG Translation API Response: {repr(translated_str[:100])}")

                # 🔥 CRITICAL FIX 1: Check for obvious API error messages
                error_keywords = ["LIMIT", "ERROR", "500", "RATE", "EXCEEDED", "TOO MANY", "HTML>", "<!DOCTYPE"]
                is_error = any(keyword in translated_str.upper() for keyword in error_keywords)
                
                # 🔥 CRITICAL FIX 2: A valid translation should be at least 30% of the original chunk's length
                min_expected_len = len(chunk) * 0.3 
                
                if translated_str and not is_error and len(translated_str) >= min_expected_len:
                    translated_chunks.append(translated_str)
                    print(f"✅ Chunk {i+1} translated successfully.")
                else:
                    print(f"⚠️ Chunk {i+1} translation REJECTED (Error: {is_error}, Length: {len(translated_str)}, Expected min: {int(min_expected_len)}). Keeping original text.")
                    translated_chunks.append(chunk)
                    
            except Exception as e:
                print(f"❌ Chunk {i+1} translation FAILED with exception: {e}. Keeping original.")
                translated_chunks.append(chunk)

        final_text = " ".join(translated_chunks)
        print(f"✅ Translation complete. Final text length: {len(final_text)}")
        return final_text


# ============================================================
# REMAINING VIEWS (Unchanged, fully working)
# ============================================================

class DocumentListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        status_filter = request.query_params.get("status")
        queryset = DocumentUpload.objects.filter(user=request.user).order_by("-created_at")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        try:
            page = max(int(request.query_params.get("page", 1)), 1)
            page_size = min(max(int(request.query_params.get("page_size", 10)), 1), 100)
        except (TypeError, ValueError):
            page, page_size = 1, 10
        start = (page - 1) * page_size
        serializer = DocumentUploadSerializer(queryset[start:start + page_size], many=True)
        return Response({"success": True, "total": queryset.count(), "page": page, "page_size": page_size, "data": serializer.data})

class DocumentDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, pk):
        try:
            doc = DocumentUpload.objects.get(pk=pk, user=request.user)
            return Response({"success": True, "data": DocumentUploadSerializer(doc).data})
        except DocumentUpload.DoesNotExist:
            return Response({"success": False, "message": "Document not found."}, status=status.HTTP_404_NOT_FOUND)

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def download_document(request, pk):
    try:
        doc = DocumentUpload.objects.get(pk=pk, user=request.user)
        if not doc.translated_file:
            return Response({"success": False, "message": "Translation not yet complete."}, status=status.HTTP_400_BAD_REQUEST)
        if not os.path.exists(doc.translated_file.path):
            raise Http404("Translated file not found.")
        return FileResponse(open(doc.translated_file.path, "rb"), as_attachment=True, filename=doc.translated_name or f"translated.{doc.output_format}")
    except DocumentUpload.DoesNotExist:
        return Response({"success": False, "message": "Document not found."}, status=status.HTTP_404_NOT_FOUND)

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def download_original(request, pk):
    try:
        doc = DocumentUpload.objects.get(pk=pk, user=request.user)
        if not os.path.exists(doc.original_file.path):
            raise Http404("Original file not found.")
        return FileResponse(open(doc.original_file.path, "rb"), as_attachment=True, filename=doc.original_name)
    except DocumentUpload.DoesNotExist:
        return Response({"success": False, "message": "Document not found."}, status=status.HTTP_404_NOT_FOUND)

@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def delete_document(request, pk):
    try:
        doc = DocumentUpload.objects.get(pk=pk, user=request.user)
        if hasattr(doc.original_file, "path") and os.path.exists(doc.original_file.path):
            os.remove(doc.original_file.path)
        if hasattr(doc.translated_file, "path") and os.path.exists(doc.translated_file.path):
            os.remove(doc.translated_file.path)
        doc.delete()
        return Response({"success": True, "message": "Document deleted successfully."})
    except DocumentUpload.DoesNotExist:
        return Response({"success": False, "message": "Document not found."}, status=status.HTTP_404_NOT_FOUND)

class DocumentTemplateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        templates = DocumentTemplate.objects.filter(user=request.user).order_by("-created_at")
        return Response({"success": True, "data": DocumentTemplateSerializer(templates, many=True).data})
    def post(self, request):
        serializer = DocumentTemplateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response({"success": True, "data": serializer.data}, status=status.HTTP_201_CREATED)
        return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def delete_template(request, pk):
    try:
        DocumentTemplate.objects.get(pk=pk, user=request.user).delete()
        return Response({"success": True, "message": "Template deleted."})
    except DocumentTemplate.DoesNotExist:
        return Response({"success": False, "message": "Template not found."}, status=status.HTTP_404_NOT_FOUND)