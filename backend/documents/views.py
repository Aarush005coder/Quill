import os
import uuid
import re

from django.conf import settings
from django.http import FileResponse, Http404

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

# ============================================================
# DOCUMENT PROCESSING
# ============================================================

from docx import Document as DocxDocument
# ✅ FIX: PyPDF2 ki jagah modern 'pypdf' use karein (better Unicode support)
from pypdf import PdfReader
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
)
from reportlab.lib.styles import getSampleStyleSheet
from html import escape

# ============================================================
# LOCAL APP IMPORTS
# ============================================================

from .models import (
    DocumentUpload,
    DocumentTemplate,
)

from .serializers import (
    DocumentUploadSerializer,
    DocumentTemplateSerializer,
)

from translation.views import TranslationService
from history.utils import save_to_history


# ═════════════════════════════════════════════════════════════
# HELPER: TEXT CLEANING
# ═════════════════════════════════════════════════════════════

def clean_extracted_text(text):
    """
    Garbage characters, control codes, aur extra spaces ko remove karta hai
    taaki translation aur PDF generation sahi se ho sake.
    """
    if not text:
        return ""
    
    # 1. Remove weird control characters (jo ■ ya + ban jate hain)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
    
    # 2. Multiple newlines ko max 2 newlines tak limit karein
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # 3. Multiple spaces ko single space mein badlein (except newlines)
    text = re.sub(r' +', ' ', text)
    
    return text.strip()


# ═════════════════════════════════════════════════════════════
# TEXT EXTRACTION & OUTPUT CREATION
# ═════════════════════════════════════════════════════════════

class DocumentProcessor:
    """
    Extract text from supported document formats and
    create translated output files.
    """

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
            # ✅ FIX: pypdf use kar rahe hain jo Unicode ko behtar handle karta hai
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
        # Ensure text is clean before writing
        text = clean_extracted_text(text)

        if output_format == "txt":
            with open(output_path, "w", encoding="utf-8") as file:
                file.write(text)
            return output_path

        elif output_format == "docx":
            document = DocxDocument()
            for paragraph in text.split("\n\n"):
                if paragraph.strip():
                    document.add_paragraph(paragraph.strip())
            document.save(output_path)
            return output_path

        elif output_format == "pdf":
            document = SimpleDocTemplate(output_path, pagesize=letter, rightMargin=45, leftMargin=45, topMargin=45, bottomMargin=45)
            styles = getSampleStyleSheet()
            story = []
            for paragraph in text.split("\n\n"):
                paragraph = paragraph.strip()
                if not paragraph:
                    continue
                safe_text = escape(paragraph)
                story.append(Paragraph(safe_text, styles["Normal"]))
                story.append(Spacer(1, 10))
            document.build(story)
            return output_path

        elif output_format == "html":
            paragraphs_html = []
            for paragraph in text.split("\n\n"):
                paragraph = paragraph.strip()
                if not paragraph:
                    continue
                paragraphs_html.append(f"<p>{escape(paragraph)}</p>")
            
            html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{escape(original_name)}</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; line-height: 1.7; color: #1e293b;">
    <h1>{escape(original_name)}</h1>
    {''.join(paragraphs_html)}
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
            return Response({"success": False, "message": "Unsupported file type. Supported: PDF, DOCX, TXT, RTF, HTML, MD."}, status=status.HTTP_400_BAD_REQUEST)

        max_file_size = getattr(settings, "MAX_DOCUMENT_UPLOAD_SIZE", 250 * 1024 * 1024)
        if uploaded_file.size > max_file_size:
            return Response({"success": False, "message": f"File too large. Maximum size is {max_file_size // (1024 * 1024)}MB."}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user

        current_pages = getattr(user, "monthly_document_pages", 0) or 0
        document_limit = getattr(user, "monthly_document_limit", 0) or 0
        is_premium = getattr(user, "is_premium", False)

        if not is_premium and document_limit > 0 and current_pages >= document_limit:
            return Response({"success": False, "message": "Monthly document limit reached. Upgrade to Pro!"}, status=status.HTTP_403_FORBIDDEN)

        source_lang = request.data.get("source_lang", "auto") or "auto"
        target_lang = request.data.get("target_lang", "en") or "en"
        output_format = (request.data.get("output_format", "pdf") or "pdf").lower()
        
        preserve_formatting_raw = request.data.get("preserve_formatting", "true")
        preserve_formatting = preserve_formatting_raw if isinstance(preserve_formatting_raw, bool) else str(preserve_formatting_raw).lower() == "true"

        if output_format not in {"txt", "docx", "pdf", "html"}:
            return Response({"success": False, "message": "Unsupported output format. Supported: TXT, DOCX, PDF, HTML."}, status=status.HTTP_400_BAD_REQUEST)

        doc = DocumentUpload.objects.create(
            user=user,
            original_file=uploaded_file,
            original_name=uploaded_file.name,
            file_type=file_type,
            file_size=uploaded_file.size,
            source_lang=source_lang,
            target_lang=target_lang,
            output_format=output_format,
            preserve_formatting=preserve_formatting,
        )

        try:
            self._process_document(doc)
        except Exception as exc:
            print("Document processing error:", exc)
            try:
                doc.mark_failed(str(exc))
            except Exception:
                pass
            return Response({"success": False, "message": f"Translation failed: {str(exc)}", "document_id": str(doc.id)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        serializer = DocumentUploadSerializer(doc)
        return Response({"success": True, "message": "Document translated successfully.", "data": serializer.data}, status=status.HTTP_200_OK)

    def _detect_file_type(self, filename):
        extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        type_map = {
            "pdf": "pdf", "docx": "docx", "doc": "docx", "txt": "txt", "rtf": "rtf",
            "html": "html", "htm": "html", "md": "md", "markdown": "md",
            "csv": "txt", "xlsx": "txt", "pptx": "txt", "epub": "txt",
        }
        return type_map.get(extension)

    def _process_document(self, doc):
        doc.mark_processing()
        original_path = doc.original_file.path

        extracted = DocumentProcessor.extract_text(original_path, doc.file_type) or ""
        
        # ✅ FIX: Final cleaning before saving to DB
        extracted = clean_extracted_text(extracted)

        if not extracted:
            raise ValueError("No readable text was found in the document.")

        doc.extracted_text = extracted[:10000]
        doc.save(update_fields=["extracted_text"])

        estimated_pages = max(1, (len(extracted) + 2999) // 3000)
        doc.page_count = estimated_pages
        doc.save(update_fields=["page_count"])

        user = doc.user
        if hasattr(user, "monthly_document_pages"):
            current_val = getattr(user, "monthly_document_pages", 0) or 0
            user.monthly_document_pages = current_val + estimated_pages
            user.save(update_fields=["monthly_document_pages"])

        translated = self._translate_long_text(extracted, doc.source_lang, doc.target_lang)
        if not translated:
            raise ValueError("Translation returned no text.")

        doc.translated_text_preview = translated[:2000]
        doc.save(update_fields=["translated_text_preview"])

        safe_original_name = re.sub(r"[^a-zA-Z0-9_\- ]+", "_", os.path.splitext(doc.original_name)[0]).strip() or "translated_document"
        output_filename = f"{safe_original_name}_translated.{doc.output_format}"

        user_directory = os.path.join(settings.MEDIA_ROOT, "documents", str(user.id))
        os.makedirs(user_directory, exist_ok=True)
        output_path = os.path.join(user_directory, f"{uuid.uuid4().hex}.{doc.output_format}")

        DocumentProcessor.create_output(translated, doc.output_format, output_path, doc.original_name)

        relative_path = os.path.relpath(output_path, settings.MEDIA_ROOT).replace("\\", "/")
        doc.mark_completed(relative_path, output_filename)

        try:
            save_to_history(
                user=doc.user,
                history_type="documents",
                title="Document Translation",
                description=f"Translated {doc.original_name} to {doc.output_format.upper()}",
                source_app="documents",
                source_model="DocumentUpload",
                source_id=str(doc.id),
                metadata={
                    "conversionType": "Document Translation",
                    "sourceLang": doc.source_lang,
                    "targetLang": doc.target_lang,
                    "outputFormat": doc.output_format,
                    "pages": doc.page_count,
                    "size": doc.file_size,
                    "output": output_filename,
                },
                output_file=relative_path,
                status="completed"
            )
            print("✅ SUCCESS: Document history saved!")
        except Exception as e:
            print("❌ Document History save error:", e)

        try:
            from users.models import Notification
            Notification.objects.create(
                user=user,
                title="Document Translation Complete",
                message=f"{doc.original_name} has been translated successfully.",
                type="document",
                link="/documents",
            )
        except Exception as notification_error:
            print("Notification creation failed:", notification_error)

    def _translate_long_text(self, text, source_lang, target_lang):
        if not text or not text.strip():
            return ""

        max_chunk = 4000
        if len(text) <= max_chunk:
            translated = TranslationService.translate(text=text, source_lang=source_lang, target_lang=target_lang, mode="text-text")
            return translated or text

        paragraphs = text.split("\n\n")
        chunks = []
        current_chunk = ""

        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue

            if len(paragraph) > max_chunk:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                for start in range(0, len(paragraph), max_chunk):
                    chunks.append(paragraph[start:start + max_chunk].strip())
                continue

            proposed_length = len(current_chunk) + len(paragraph) + 2
            if proposed_length <= max_chunk:
                current_chunk = f"{current_chunk}\n\n{paragraph}" if current_chunk else paragraph
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = paragraph

        if current_chunk:
            chunks.append(current_chunk.strip())

        translated_chunks = []
        for index, chunk in enumerate(chunks, start=1):
            try:
                print(f"Translating document chunk {index}/{len(chunks)}...")
                translated = TranslationService.translate(text=chunk, source_lang=source_lang, target_lang=target_lang, mode="text-text")
                translated_chunks.append(translated if translated else chunk)
            except Exception as exc:
                print(f"Chunk {index} translation error:", exc)
                translated_chunks.append(chunk)

        return "\n\n".join(translated_chunks)


# ═════════════════════════════════════════════════════════════
# DOCUMENT LIST
# ═════════════════════════════════════════════════════════════

class DocumentListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        status_filter = request.query_params.get("status")
        queryset = DocumentUpload.objects.filter(user=request.user).order_by("-created_at")

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        try:
            page = max(int(request.query_params.get("page", 1)), 1)
        except (TypeError, ValueError):
            page = 1

        try:
            page_size = min(max(int(request.query_params.get("page_size", 10)), 1), 100)
        except (TypeError, ValueError):
            page_size = 10

        start = (page - 1) * page_size
        end = start + page_size
        total = queryset.count()
        serializer = DocumentUploadSerializer(queryset[start:end], many=True)

        return Response({"success": True, "total": total, "page": page, "page_size": page_size, "data": serializer.data})


# ═════════════════════════════════════════════════════════════
# DOCUMENT DETAIL
# ═════════════════════════════════════════════════════════════

class DocumentDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            doc = DocumentUpload.objects.get(pk=pk, user=request.user)
            serializer = DocumentUploadSerializer(doc)
            return Response({"success": True, "data": serializer.data})
        except DocumentUpload.DoesNotExist:
            return Response({"success": False, "message": "Document not found."}, status=status.HTTP_404_NOT_FOUND)


# ═════════════════════════════════════════════════════════════
# DOWNLOAD TRANSLATED DOCUMENT
# ═════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def download_document(request, pk):
    try:
        doc = DocumentUpload.objects.get(pk=pk, user=request.user)
        if not doc.translated_file:
            return Response({"success": False, "message": "Translation not yet complete."}, status=status.HTTP_400_BAD_REQUEST)

        file_path = doc.translated_file.path
        if not os.path.exists(file_path):
            raise Http404("Translated file not found.")

        response = FileResponse(open(file_path, "rb"), as_attachment=True, filename=doc.translated_name or f"translated.{doc.output_format}")
        response["Content-Type"] = "application/octet-stream"
        return response
    except DocumentUpload.DoesNotExist:
        return Response({"success": False, "message": "Document not found."}, status=status.HTTP_404_NOT_FOUND)


# ═════════════════════════════════════════════════════════════
# DOWNLOAD ORIGINAL
# ═════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def download_original(request, pk):
    try:
        doc = DocumentUpload.objects.get(pk=pk, user=request.user)
        if not doc.original_file:
            return Response({"success": False, "message": "Original file not found."}, status=status.HTTP_404_NOT_FOUND)

        file_path = doc.original_file.path
        if not os.path.exists(file_path):
            raise Http404("Original file not found.")

        response = FileResponse(open(file_path, "rb"), as_attachment=True, filename=doc.original_name)
        response["Content-Type"] = "application/octet-stream"
        return response
    except DocumentUpload.DoesNotExist:
        return Response({"success": False, "message": "Document not found."}, status=status.HTTP_404_NOT_FOUND)


# ═════════════════════════════════════════════════════════════
# DELETE DOCUMENT
# ═════════════════════════════════════════════════════════════

@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def delete_document(request, pk):
    try:
        doc = DocumentUpload.objects.get(pk=pk, user=request.user)

        if doc.original_file and hasattr(doc.original_file, "path"):
            try:
                original_path = doc.original_file.path
                if os.path.exists(original_path):
                    os.remove(original_path)
            except Exception as exc:
                print("Original file deletion error:", exc)

        if doc.translated_file and hasattr(doc.translated_file, "path"):
            try:
                translated_path = doc.translated_file.path
                if os.path.exists(translated_path):
                    os.remove(translated_path)
            except Exception as exc:
                print("Translated file deletion error:", exc)

        doc.delete()
        return Response({"success": True, "message": "Document deleted successfully."})
    except DocumentUpload.DoesNotExist:
        return Response({"success": False, "message": "Document not found."}, status=status.HTTP_404_NOT_FOUND)


# ═════════════════════════════════════════════════════════════
# DOCUMENT TEMPLATES
# ═════════════════════════════════════════════════════════════

class DocumentTemplateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        templates = DocumentTemplate.objects.filter(user=request.user).order_by("-created_at")
        serializer = DocumentTemplateSerializer(templates, many=True)
        return Response({"success": True, "data": serializer.data})

    def post(self, request):
        serializer = DocumentTemplateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response({"success": True, "data": serializer.data}, status=status.HTTP_201_CREATED)
        return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


# ═════════════════════════════════════════════════════════════
# DELETE TEMPLATE
# ═════════════════════════════════════════════════════════════

@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def delete_template(request, pk):
    try:
        template = DocumentTemplate.objects.get(pk=pk, user=request.user)
        template.delete()
        return Response({"success": True, "message": "Template deleted."})
    except DocumentTemplate.DoesNotExist:
        return Response({"success": False, "message": "Template not found."}, status=status.HTTP_404_NOT_FOUND)