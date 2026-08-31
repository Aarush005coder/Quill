import os
import io
import uuid
import re
import logging

from django.conf import settings
from django.http import FileResponse, Http404

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from docx import Document as DocxDocument
from docx.enum.text import WD_BREAK
from pypdf import PdfReader
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

try:
    from reportlab.lib.utils import simpleSplit
except Exception:
    simpleSplit = None

from html import escape

from .models import DocumentUpload, DocumentTemplate
from .serializers import DocumentUploadSerializer, DocumentTemplateSerializer
from translation.views import TranslationService
from history.utils import save_to_history


# ============================================================
# LOGGER
# ============================================================

logger = logging.getLogger(__name__)


# ============================================================
# HELPER: TEXT CLEANING
# ============================================================

def clean_extracted_text(text):
    """
    Clean document text while keeping it suitable for normal
    single-document processing.
    """
    if not text:
        return ""

    text = re.sub(
        r"[\x00-\x08\x0b\x0e-\x1f\x7f-\x9f]",
        "",
        str(text),
    )

    text = text.replace("\r\n", "\n").replace("\r", "\n")

    lines = [
        re.sub(r"[ \t]+", " ", line).strip()
        for line in text.split("\n")
    ]

    lines = [line for line in lines if line]

    return " ".join(lines).strip()


def clean_page_text(text):
    """
    Clean a single PDF/document page without destroying its
    page boundary or all internal line breaks.
    """
    if not text:
        return ""

    text = re.sub(
        r"[\x00-\x08\x0b\x0e-\x1f\x7f-\x9f]",
        "",
        str(text),
    )

    text = text.replace("\r\n", "\n").replace("\r", "\n")

    cleaned_lines = []
    for line in text.split("\n"):
        line = re.sub(r"[ \t]+", " ", line).strip()
        if line:
            cleaned_lines.append(line)

    return "\n".join(cleaned_lines).strip()


# ============================================================
# TEXT / PAGE EXTRACTION
# ============================================================

class DocumentProcessor:

    @staticmethod
    def extract_pages(file_path, file_type):
        """
        Return a list where index N corresponds to original page N.

        IMPORTANT:
        PDF page count is always based on the real PDF page count.
        We NEVER estimate pages from character length.
        """

        if file_type == "pdf":
            reader = PdfReader(file_path)
            pages = []

            for page_number, page in enumerate(reader.pages, start=1):
                try:
                    page_text = page.extract_text() or ""
                except Exception as exc:
                    logger.warning(
                        "PDF text extraction failed on page %s: %s",
                        page_number,
                        exc,
                    )
                    page_text = ""

                pages.append(clean_page_text(page_text))

            return pages

        if file_type in {"txt", "md", "rtf"}:
            with open(
                file_path,
                "r",
                encoding="utf-8",
                errors="ignore",
            ) as file:
                text = file.read()

            # Preserve explicitly supplied page breaks for text files.
            parts = re.split(
                r"---\s*PAGE\s*BREAK\s*---|\f",
                text,
                flags=re.IGNORECASE,
            )

            return [
                clean_page_text(part)
                for part in (parts or [text])
            ]

        if file_type == "docx":
            document = DocxDocument(file_path)

            page_groups = [[]]
            explicit_break_found = False

            for paragraph in document.paragraphs:
                paragraph_text = paragraph.text or ""

                if (
                    paragraph_text.strip()
                ):
                    page_groups[-1].append(
                        paragraph_text.strip()
                    )

                # Detect explicit page breaks inside runs.
                paragraph_has_break = False
                for run in paragraph.runs:
                    xml = run._element.xml
                    if (
                        "w:type=\"page\"" in xml
                        or "w:type='page'" in xml
                    ):
                        paragraph_has_break = True
                        explicit_break_found = True
                        break

                if paragraph_has_break:
                    page_groups.append([])

            if explicit_break_found:
                return [
                    clean_page_text("\n".join(group))
                    for group in page_groups
                ]

            text = "\n".join(
                paragraph.text
                for paragraph in document.paragraphs
                if paragraph.text.strip()
            )

            return [clean_page_text(text)]

        if file_type == "html":
            from html.parser import HTMLParser

            class MLStripper(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.fed = []

                def handle_data(self, data):
                    if data and data.strip():
                        self.fed.append(data.strip())

                def get_data(self):
                    return "\n".join(self.fed)

            with open(
                file_path,
                "r",
                encoding="utf-8",
                errors="ignore",
            ) as file:
                parser = MLStripper()
                parser.feed(file.read())
                text = parser.get_data()

            return [clean_page_text(text)]

        raise ValueError(
            f"Unsupported file type: {file_type}"
        )

    @staticmethod
    def extract_text(file_path, file_type):
        """
        Backward-compatible whole-document extraction.
        """
        pages = DocumentProcessor.extract_pages(
            file_path,
            file_type,
        )

        return "\n\n".join(
            page for page in pages if page
        ).strip()

    # ========================================================
    # FONT HELPERS
    # ========================================================

    @staticmethod
    def _register_pdf_font():
        """
        Register the best available Unicode font.

        This keeps Hindi/Indic text much safer than Helvetica.
        """
        candidates = [
            (
                "QuillUnicode",
                r"C:\Windows\Fonts\Nirmala.ttf",
            ),
            (
                "QuillUnicode",
                r"C:\Windows\Fonts\segoeui.ttf",
            ),
            (
                "QuillUnicode",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            ),
            (
                "QuillUnicode",
                "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
            ),
            (
                "QuillUnicode",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            ),
        ]

        for font_name, font_path in candidates:
            if not os.path.exists(font_path):
                continue

            try:
                if font_name not in pdfmetrics.getRegisteredFontNames():
                    pdfmetrics.registerFont(
                        TTFont(
                            font_name,
                            font_path,
                        )
                    )
                return font_name
            except Exception as exc:
                logger.warning(
                    "Could not load PDF font %s: %s",
                    font_path,
                    exc,
                )

        return "Helvetica"

    @staticmethod
    def _wrap_page_text(
        text,
        font_name,
        font_size,
        max_width,
    ):
        """
        Word-wrap text. For languages without spaces, fall back
        to character-level wrapping.
        """
        text = str(text or "")
        paragraphs = text.splitlines() or [""]

        lines = []

        for paragraph in paragraphs:
            paragraph = paragraph.strip()

            if not paragraph:
                lines.append("")
                continue

            words = paragraph.split()

            if len(words) == 1 and pdfmetrics.stringWidth(
                paragraph,
                font_name,
                font_size,
            ) <= max_width:
                lines.append(paragraph)
                continue

            current = ""

            for word in words:
                candidate = (
                    word
                    if not current
                    else f"{current} {word}"
                )

                if (
                    pdfmetrics.stringWidth(
                        candidate,
                        font_name,
                        font_size,
                    )
                    <= max_width
                ):
                    current = candidate
                    continue

                if current:
                    lines.append(current)

                # Very long token / CJK / URL style fallback.
                if (
                    pdfmetrics.stringWidth(
                        word,
                        font_name,
                        font_size,
                    )
                    > max_width
                ):
                    part = ""

                    for char in word:
                        candidate_char = (
                            char
                            if not part
                            else part + char
                        )

                        if (
                            pdfmetrics.stringWidth(
                                candidate_char,
                                font_name,
                                font_size,
                            )
                            <= max_width
                        ):
                            part = candidate_char
                        else:
                            if part:
                                lines.append(part)
                            part = char

                    current = part
                else:
                    current = word

            if current:
                lines.append(current)

        return lines

    @staticmethod
    def _draw_fitted_page(
        pdf,
        text,
        page_width,
        page_height,
    ):
        """
        Draw one translated source page as exactly ONE PDF page.

        Font size is reduced until the page fits. The function never
        calls showPage() by itself.
        """
        margin_x = 40
        margin_y = 40
        max_width = max(
            page_width - (margin_x * 2),
            20,
        )
        available_height = max(
            page_height - (margin_y * 2),
            20,
        )

        font_name = (
            DocumentProcessor._register_pdf_font()
        )

        text = str(text or "").strip()

        if not text:
            pdf.setFont(
                font_name,
                11,
            )
            pdf.setFillColorRGB(
                0.45,
                0.50,
                0.58,
            )
            pdf.drawString(
                margin_x,
                page_height - margin_y,
                "No readable text extracted from this page.",
            )
            pdf.setFillColorRGB(0, 0, 0)
            return

        chosen_size = 12
        chosen_lines = []

        # Try from readable size down to a very compact size.
        size = 12

        while size >= 4:
            lines = DocumentProcessor._wrap_page_text(
                text,
                font_name,
                size,
                max_width,
            )

            leading = max(
                size * 1.25,
                6,
            )

            required_height = (
                len(lines) * leading
            )

            if required_height <= available_height:
                chosen_size = size
                chosen_lines = lines
                break

            size -= 0.5

        # Safety fallback. This should almost never be reached.
        if not chosen_lines:
            chosen_size = 4
            chosen_lines = (
                DocumentProcessor._wrap_page_text(
                    text,
                    font_name,
                    chosen_size,
                    max_width,
                )
            )

        leading = max(
            chosen_size * 1.25,
            5,
        )

        # Center vertically when the page has less content.
        total_height = len(chosen_lines) * leading
        y = page_height - margin_y

        if total_height < available_height:
            y = (
                page_height
                - margin_y
            )

        pdf.setFont(
            font_name,
            chosen_size,
        )
        pdf.setFillColorRGB(
            0.12,
            0.18,
            0.25,
        )

        for line in chosen_lines:
            if y < margin_y:
                break

            if line:
                pdf.drawString(
                    margin_x,
                    y,
                    line,
                )

            y -= leading

        pdf.setFillColorRGB(0, 0, 0)

    # ========================================================
    # EXACT-PAGE PDF OUTPUT
    # ========================================================

    @staticmethod
    def create_pdf_from_pages(
        translated_pages,
        output_path,
        original_pdf_path=None,
    ):
        """
        Create a PDF with EXACTLY len(translated_pages) pages.

        For PDF input, each original page produces one output page.
        Original page sizes are preserved when possible.
        """
        page_sizes = []

        if original_pdf_path and os.path.exists(
            original_pdf_path
        ):
            try:
                reader = PdfReader(
                    original_pdf_path
                )

                for page in reader.pages:
                    width = float(
                        page.mediabox.width
                    )
                    height = float(
                        page.mediabox.height
                    )

                    page_sizes.append(
                        (width, height)
                    )
            except Exception as exc:
                logger.warning(
                    "Could not read original PDF page sizes: %s",
                    exc,
                )

        pdf = None

        try:
            pdf = canvas.Canvas(
                output_path,
                pagesize=letter,
            )

            total_pages = len(
                translated_pages
            )

            for index in range(total_pages):
                if index < len(page_sizes):
                    width, height = page_sizes[index]
                    pdf.setPageSize(
                        (
                            width,
                            height,
                        )
                    )
                else:
                    width, height = letter
                    pdf.setPageSize(
                        letter
                    )

                DocumentProcessor._draw_fitted_page(
                    pdf,
                    translated_pages[index],
                    width,
                    height,
                )

                # EXACTLY ONE output page for this source page.
                pdf.showPage()

            pdf.save()

        except Exception:
            if pdf is not None:
                try:
                    pdf.save()
                except Exception:
                    pass
            raise

        return output_path

    # ========================================================
    # GENERAL OUTPUT
    # ========================================================

    @staticmethod
    def create_output(
        text,
        output_format,
        output_path,
        original_name,
        pages=None,
        original_pdf_path=None,
    ):
        """
        Existing output API retained.

        pages is optional. When PDF pages are provided, PDF output
        uses exact one-page-per-source-page generation.
        """
        output_format = (
            str(output_format or "pdf")
            .lower()
            .strip()
        )

        if output_format == "txt":
            if pages:
                final_text = "\n\n".join(
                    f"--- PAGE {i + 1} ---\n{page}"
                    for i, page in enumerate(pages)
                )
            else:
                final_text = clean_extracted_text(
                    text
                )

            with open(
                output_path,
                "w",
                encoding="utf-8",
            ) as file:
                file.write(final_text)

            return output_path

        if output_format == "docx":
            document = DocxDocument()

            if pages:
                for index, page_text in enumerate(pages):
                    if page_text:
                        document.add_paragraph(
                            page_text
                        )

                    if index < len(pages) - 1:
                        paragraph = document.add_paragraph()
                        run = paragraph.add_run()
                        run.add_break(
                            WD_BREAK.PAGE
                        )
            else:
                document.add_paragraph(
                    clean_extracted_text(text)
                )

            document.save(
                output_path
            )
            return output_path

        if output_format == "pdf":
            if pages:
                return (
                    DocumentProcessor.create_pdf_from_pages(
                        pages,
                        output_path,
                        original_pdf_path=original_pdf_path,
                    )
                )

            # Backward-compatible one-page PDF.
            return (
                DocumentProcessor.create_pdf_from_pages(
                    [clean_extracted_text(text)],
                    output_path,
                    original_pdf_path=None,
                )
            )

        if output_format == "html":
            if pages:
                sections = []

                for index, page_text in enumerate(pages):
                    page_html = escape(
                        page_text or ""
                    ).replace(
                        "\n",
                        "<br>",
                    )

                    sections.append(
                        f"""
                        <section class="doc-page">
                            <div class="page-number">
                                Page {index + 1}
                            </div>
                            <div class="page-content">
                                {page_html or "&nbsp;"}
                            </div>
                        </section>
                        """
                    )

                body = "".join(
                    sections
                )
            else:
                body = (
                    f'<section class="doc-page">'
                    f'<div class="page-content">'
                    f'{escape(clean_extracted_text(text))}'
                    f'</div></section>'
                )

            html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{escape(original_name)}</title>
    <style>
        body {{
            margin: 0;
            background: #e5e7eb;
            font-family: Arial, sans-serif;
            color: #1e293b;
        }}

        .doc-page {{
            width: 210mm;
            min-height: 297mm;
            box-sizing: border-box;
            background: white;
            margin: 20px auto;
            padding: 40px;
            position: relative;
            page-break-after: always;
            break-after: page;
            overflow: hidden;
        }}

        .doc-page:last-child {{
            page-break-after: auto;
            break-after: auto;
        }}

        .page-number {{
            font-size: 10px;
            color: #94a3b8;
            margin-bottom: 18px;
        }}

        .page-content {{
            font-size: 12px;
            line-height: 1.6;
            white-space: normal;
            overflow-wrap: anywhere;
        }}

        @media print {{
            body {{
                background: white;
            }}

            .doc-page {{
                margin: 0;
                width: auto;
                min-height: 0;
                height: 297mm;
            }}
        }}
    </style>
</head>
<body>
    {body}
</body>
</html>"""

            with open(
                output_path,
                "w",
                encoding="utf-8",
            ) as file:
                file.write(html_content)

            return output_path

        raise ValueError(
            f"Unsupported output format: {output_format}"
        )


# ============================================================
# DOCUMENT UPLOAD + TRANSLATION
# ============================================================

class DocumentUploadView(APIView):

    permission_classes = [
        permissions.IsAuthenticated
    ]

    def post(self, request):

        if "file" not in request.FILES:
            return Response(
                {
                    "success": False,
                    "message": "No file provided.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        uploaded_file = request.FILES[
            "file"
        ]

        file_type = (
            self._detect_file_type(
                uploaded_file.name
            )
        )

        if not file_type:
            return Response(
                {
                    "success": False,
                    "message": "Unsupported file type.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_file_size = getattr(
            settings,
            "MAX_DOCUMENT_UPLOAD_SIZE",
            250 * 1024 * 1024,
        )

        if uploaded_file.size > max_file_size:
            return Response(
                {
                    "success": False,
                    "message": "File too large.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user

        source_lang = (
            request.data.get(
                "source_lang",
                "auto",
            )
            or "auto"
        )

        target_lang = (
            request.data.get(
                "target_lang",
                "en",
            )
            or "en"
        )

        output_format = (
            request.data.get(
                "output_format",
                "pdf",
            )
            or "pdf"
        ).lower()

        if output_format not in {
            "txt",
            "docx",
            "pdf",
            "html",
        }:
            output_format = "pdf"

        doc = DocumentUpload.objects.create(
            user=user,
            original_file=uploaded_file,
            original_name=uploaded_file.name,
            file_type=file_type,
            file_size=uploaded_file.size,
            source_lang=source_lang,
            target_lang=target_lang,
            output_format=output_format,
            preserve_formatting=True,
        )

        try:
            self._process_document(
                doc
            )

        except Exception as exc:
            logger.exception(
                "Document processing error: %s",
                exc,
            )

            doc.mark_failed(
                str(exc)
            )

            return Response(
                {
                    "success": False,
                    "message": str(exc),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "success": True,
                "message": (
                    "Document translated successfully."
                ),
                "data": DocumentUploadSerializer(
                    doc
                ).data,
            },
            status=status.HTTP_200_OK,
        )

    def _detect_file_type(
        self,
        filename,
    ):
        extension = (
            filename.rsplit(
                ".",
                1,
            )[-1].lower()
            if "." in filename
            else ""
        )

        return {
            "pdf": "pdf",
            "docx": "docx",
            "doc": "docx",
            "txt": "txt",
            "rtf": "rtf",
            "html": "html",
            "htm": "html",
            "md": "md",
        }.get(extension)

    # ========================================================
    # PROCESS DOCUMENT
    # ========================================================

    def _process_document(
        self,
        doc,
    ):
        doc.mark_processing()

        original_path = (
            doc.original_file.path
        )

        # ----------------------------------------------------
        # PDF: REAL PAGE-BY-PAGE PROCESSING
        # ----------------------------------------------------

        if doc.file_type == "pdf":

            pages = (
                DocumentProcessor.extract_pages(
                    original_path,
                    "pdf",
                )
            )

            # The REAL number of pages in the uploaded PDF.
            real_page_count = len(
                pages
            )

            if real_page_count < 1:
                raise ValueError(
                    "PDF contains no pages."
                )

            print(
                f"📄 Original PDF pages: "
                f"{real_page_count}"
            )

            # Store page-preserving extracted text.
            extracted_text = "\n\n".join(
                page for page in pages
            )

            doc.extracted_text = (
                extracted_text[:10000]
            )

            doc.page_count = (
                real_page_count
            )

            doc.save(
                update_fields=[
                    "extracted_text",
                    "page_count",
                ]
            )

            # Translate each original page separately.
            translated_pages = []

            for index, page_text in enumerate(
                pages,
                start=1,
            ):

                print(
                    f"🔄 Translating PDF page "
                    f"{index}/{real_page_count}..."
                )

                if not page_text.strip():
                    # Keep empty/scanned-only page.
                    translated_pages.append("")
                    continue

                translated_page = (
                    self._translate_long_text(
                        page_text,
                        doc.source_lang,
                        doc.target_lang,
                    )
                )

                if not translated_page:
                    # Never remove a source page.
                    translated_page = page_text

                translated_pages.append(
                    translated_page
                )

            translated_full_text = (
                "\n\n".join(
                    translated_pages
                )
            )

            if not translated_full_text.strip():
                # A PDF may contain image-only pages.
                # We still create an exact-page output instead
                # of turning a 5-page PDF into a 1-page file.
                logger.warning(
                    "PDF has no extractable text. "
                    "Preserving all %s pages.",
                    real_page_count,
                )

            doc.translated_text_preview = (
                translated_full_text[:2000]
            )

            doc.save(
                update_fields=[
                    "translated_text_preview"
                ]
            )

            safe_name = self._safe_name(
                doc.original_name
            )

            output_path = os.path.join(
                settings.MEDIA_ROOT,
                "documents",
                str(doc.user.id),
                (
                    f"{uuid.uuid4().hex}."
                    f"{doc.output_format}"
                ),
            )

            os.makedirs(
                os.path.dirname(output_path),
                exist_ok=True,
            )

            if doc.output_format == "pdf":
                # EXACT SAME NUMBER OF PAGES.
                DocumentProcessor.create_pdf_from_pages(
                    translated_pages,
                    output_path,
                    original_pdf_path=original_path,
                )

            else:
                # Also preserve page boundaries in non-PDF outputs.
                DocumentProcessor.create_output(
                    translated_full_text,
                    doc.output_format,
                    output_path,
                    doc.original_name,
                    pages=translated_pages,
                    original_pdf_path=original_path,
                )

            relative_path = os.path.relpath(
                output_path,
                settings.MEDIA_ROOT,
            ).replace("\\", "/")

            doc.mark_completed(
                relative_path,
                (
                    f"{safe_name}_translated."
                    f"{doc.output_format}"
                ),
            )

            self._save_history(
                doc,
                relative_path,
            )

            return

        # ----------------------------------------------------
        # NON-PDF DOCUMENTS
        # ----------------------------------------------------

        extracted = (
            DocumentProcessor.extract_text(
                original_path,
                doc.file_type,
            )
            or ""
        )

        print(
            f"📊 Extracted text length: "
            f"{len(extracted)} characters"
        )

        if not extracted.strip():
            raise ValueError(
                "No readable text found in the document."
            )

        # Non-PDF files do not necessarily have a physical
        # page concept. Keep the original behavior here.
        pages = (
            DocumentProcessor.extract_pages(
                original_path,
                doc.file_type,
            )
        )

        doc.extracted_text = (
            extracted[:10000]
        )

        doc.page_count = max(
            1,
            len(pages),
        )

        doc.save(
            update_fields=[
                "extracted_text",
                "page_count",
            ]
        )

        print(
            f"🔄 Starting translation: "
            f"{doc.source_lang} -> "
            f"{doc.target_lang}"
        )

        translated = (
            self._translate_long_text(
                extracted,
                doc.source_lang,
                doc.target_lang,
            )
        )

        if not translated or not translated.strip():
            raise ValueError(
                "Translation returned no text."
            )

        print(
            "✅ Translation successful. "
            f"Translated length: {len(translated)}"
        )

        doc.translated_text_preview = (
            translated[:2000]
        )

        doc.save(
            update_fields=[
                "translated_text_preview"
            ]
        )

        safe_name = self._safe_name(
            doc.original_name
        )

        output_path = os.path.join(
            settings.MEDIA_ROOT,
            "documents",
            str(doc.user.id),
            (
                f"{uuid.uuid4().hex}."
                f"{doc.output_format}"
            ),
        )

        os.makedirs(
            os.path.dirname(output_path),
            exist_ok=True,
        )

        DocumentProcessor.create_output(
            translated,
            doc.output_format,
            output_path,
            doc.original_name,
        )

        relative_path = os.path.relpath(
            output_path,
            settings.MEDIA_ROOT,
        ).replace("\\", "/")

        doc.mark_completed(
            relative_path,
            (
                f"{safe_name}_translated."
                f"{doc.output_format}"
            ),
        )

        self._save_history(
            doc,
            relative_path,
        )

    # ========================================================
    # SAFE NAME
    # ========================================================

    @staticmethod
    def _safe_name(
        filename,
    ):
        return (
            re.sub(
                r"[^a-zA-Z0-9_\- ]+",
                "_",
                os.path.splitext(filename)[0],
            ).strip()
            or "translated"
        )

    # ========================================================
    # HISTORY
    # ========================================================

    @staticmethod
    def _save_history(
        doc,
        relative_path,
    ):
        try:
            save_to_history(
                user=doc.user,
                history_type="documents",
                title="Document Translation",
                description=(
                    f"Translated "
                    f"{doc.original_name}"
                ),
                source_app="documents",
                source_model="DocumentUpload",
                source_id=str(doc.id),
                metadata={
                    "outputFormat": (
                        doc.output_format
                    ),
                    "pages": (
                        doc.page_count
                    ),
                    "size": doc.file_size,
                    "output": (
                        doc.translated_name
                    ),
                },
                output_file=relative_path,
                status="completed",
            )

        except Exception as exc:
            logger.warning(
                "History save error: %s",
                exc,
            )

    # ========================================================
    # LONG TEXT TRANSLATION
    # ========================================================

    def _translate_long_text(
        self,
        text,
        source_lang,
        target_lang,
    ):
        if not text or not text.strip():
            return ""

        src = (
            "auto"
            if source_lang == "auto"
            else source_lang
        )

        max_chunk = 3500

        # Keep paragraphs/line structure as much as possible.
        normalized = (
            str(text)
            .replace("\r\n", "\n")
            .replace("\r", "\n")
        )

        chunks = []
        current_chunk = ""

        for paragraph in normalized.split("\n"):
            paragraph = paragraph.strip()

            if not paragraph:
                if current_chunk:
                    chunks.append(
                        current_chunk
                    )
                    current_chunk = ""
                continue

            words = paragraph.split()

            for word in words:
                candidate = (
                    word
                    if not current_chunk
                    else f"{current_chunk} {word}"
                )

                if (
                    len(candidate)
                    <= max_chunk
                ):
                    current_chunk = candidate
                else:
                    if current_chunk:
                        chunks.append(
                            current_chunk
                        )

                    # Handle a single giant token.
                    if len(word) > max_chunk:
                        for start in range(
                            0,
                            len(word),
                            max_chunk,
                        ):
                            chunks.append(
                                word[
                                    start:
                                    start + max_chunk
                                ]
                            )
                        current_chunk = ""
                    else:
                        current_chunk = word

            if current_chunk:
                chunks.append(
                    current_chunk
                )
                current_chunk = ""

        if not chunks and normalized.strip():
            chunks.append(
                normalized.strip()
            )

        translated_chunks = []

        for i, chunk in enumerate(
            chunks,
            start=1,
        ):
            try:
                print(
                    f"Translating chunk "
                    f"{i}/{len(chunks)} "
                    f"(Original Length: "
                    f"{len(chunk)})..."
                )

                translated = (
                    TranslationService.translate(
                        text=chunk,
                        source_lang=src,
                        target_lang=target_lang,
                        mode="text_to_text",
                    )
                )

                translated_str = str(
                    translated or ""
                ).strip()

                print(
                    "DEBUG Translation API Response: "
                    f"{repr(translated_str[:100])}"
                )

                # Obvious API error detection.
                error_keywords = {
                    "LIMIT",
                    "ERROR",
                    "500",
                    "RATE",
                    "EXCEEDED",
                    "TOO MANY",
                    "<HTML>",
                    "<!DOCTYPE",
                }

                upper = (
                    translated_str.upper()
                )

                is_error = any(
                    keyword in upper
                    for keyword in error_keywords
                )

                min_expected_len = (
                    len(chunk) * 0.30
                )

                if (
                    translated_str
                    and not is_error
                    and (
                        len(translated_str)
                        >= min_expected_len
                    )
                ):
                    translated_chunks.append(
                        translated_str
                    )

                    print(
                        f"✅ Chunk {i} "
                        "translated successfully."
                    )

                else:
                    # NEVER delete the original content
                    # because a translation API returned bad data.
                    print(
                        f"⚠️ Chunk {i} "
                        "translation rejected. "
                        "Keeping original text."
                    )

                    translated_chunks.append(
                        chunk
                    )

            except Exception as exc:
                print(
                    f"❌ Chunk {i} "
                    f"translation failed: {exc}. "
                    "Keeping original."
                )

                translated_chunks.append(
                    chunk
                )

        final_text = " ".join(
            translated_chunks
        ).strip()

        print(
            "✅ Translation complete. "
            f"Final text length: {len(final_text)}"
        )

        return final_text


# ============================================================
# DOCUMENT LIST
# ============================================================

class DocumentListView(APIView):

    permission_classes = [
        permissions.IsAuthenticated
    ]

    def get(self, request):

        status_filter = (
            request.query_params.get(
                "status"
            )
        )

        queryset = (
            DocumentUpload.objects
            .filter(
                user=request.user
            )
            .order_by(
                "-created_at"
            )
        )

        if status_filter:
            queryset = queryset.filter(
                status=status_filter
            )

        try:
            page = max(
                int(
                    request.query_params.get(
                        "page",
                        1,
                    )
                ),
                1,
            )

            page_size = min(
                max(
                    int(
                        request.query_params.get(
                            "page_size",
                            10,
                        )
                    ),
                    1,
                ),
                100,
            )

        except (
            TypeError,
            ValueError,
        ):
            page = 1
            page_size = 10

        start = (
            page - 1
        ) * page_size

        serializer = (
            DocumentUploadSerializer(
                queryset[
                    start:
                    start + page_size
                ],
                many=True,
            )
        )

        return Response(
            {
                "success": True,
                "total": queryset.count(),
                "page": page,
                "page_size": page_size,
                "data": serializer.data,
            }
        )


# ============================================================
# DOCUMENT DETAIL
# ============================================================

class DocumentDetailView(APIView):

    permission_classes = [
        permissions.IsAuthenticated
    ]

    def get(
        self,
        request,
        pk,
    ):
        try:

            doc = (
                DocumentUpload.objects.get(
                    pk=pk,
                    user=request.user,
                )
            )

            return Response(
                {
                    "success": True,
                    "data": (
                        DocumentUploadSerializer(
                            doc
                        ).data
                    ),
                }
            )

        except DocumentUpload.DoesNotExist:

            return Response(
                {
                    "success": False,
                    "message": (
                        "Document not found."
                    ),
                },
                status=(
                    status.HTTP_404_NOT_FOUND
                ),
            )


# ============================================================
# DOWNLOAD TRANSLATED DOCUMENT
# ============================================================

@api_view(["GET"])
@permission_classes(
    [permissions.IsAuthenticated]
)
def download_document(
    request,
    pk,
):
    try:

        doc = (
            DocumentUpload.objects.get(
                pk=pk,
                user=request.user,
            )
        )

        if not doc.translated_file:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Translation not yet complete."
                    ),
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        if not os.path.exists(
            doc.translated_file.path
        ):
            raise Http404(
                "Translated file not found."
            )

        return FileResponse(
            open(
                doc.translated_file.path,
                "rb",
            ),
            as_attachment=True,
            filename=(
                doc.translated_name
                or (
                    f"translated."
                    f"{doc.output_format}"
                )
            ),
        )

    except DocumentUpload.DoesNotExist:

        return Response(
            {
                "success": False,
                "message": (
                    "Document not found."
                ),
            },
            status=(
                status.HTTP_404_NOT_FOUND
            ),
        )


# ============================================================
# DOWNLOAD ORIGINAL DOCUMENT
# ============================================================

@api_view(["GET"])
@permission_classes(
    [permissions.IsAuthenticated]
)
def download_original(
    request,
    pk,
):
    try:

        doc = (
            DocumentUpload.objects.get(
                pk=pk,
                user=request.user,
            )
        )

        if not os.path.exists(
            doc.original_file.path
        ):
            raise Http404(
                "Original file not found."
            )

        return FileResponse(
            open(
                doc.original_file.path,
                "rb",
            ),
            as_attachment=True,
            filename=doc.original_name,
        )

    except DocumentUpload.DoesNotExist:

        return Response(
            {
                "success": False,
                "message": (
                    "Document not found."
                ),
            },
            status=(
                status.HTTP_404_NOT_FOUND
            ),
        )


# ============================================================
# DELETE DOCUMENT
# ============================================================

@api_view(["DELETE"])
@permission_classes(
    [permissions.IsAuthenticated]
)
def delete_document(
    request,
    pk,
):
    try:

        doc = (
            DocumentUpload.objects.get(
                pk=pk,
                user=request.user,
            )
        )

        if (
            hasattr(
                doc.original_file,
                "path",
            )
            and os.path.exists(
                doc.original_file.path
            )
        ):
            os.remove(
                doc.original_file.path
            )

        if (
            hasattr(
                doc.translated_file,
                "path",
            )
            and os.path.exists(
                doc.translated_file.path
            )
        ):
            os.remove(
                doc.translated_file.path
            )

        doc.delete()

        return Response(
            {
                "success": True,
                "message": (
                    "Document deleted successfully."
                ),
            }
        )

    except DocumentUpload.DoesNotExist:

        return Response(
            {
                "success": False,
                "message": (
                    "Document not found."
                ),
            },
            status=(
                status.HTTP_404_NOT_FOUND
            ),
        )


# ============================================================
# DOCUMENT TEMPLATES
# ============================================================

class DocumentTemplateView(APIView):

    permission_classes = [
        permissions.IsAuthenticated
    ]

    def get(
        self,
        request,
    ):
        templates = (
            DocumentTemplate.objects
            .filter(
                user=request.user
            )
            .order_by(
                "-created_at"
            )
        )

        return Response(
            {
                "success": True,
                "data": (
                    DocumentTemplateSerializer(
                        templates,
                        many=True,
                    ).data
                ),
            }
        )

    def post(
        self,
        request,
    ):
        serializer = (
            DocumentTemplateSerializer(
                data=request.data
            )
        )

        if serializer.is_valid():

            serializer.save(
                user=request.user
            )

            return Response(
                {
                    "success": True,
                    "data": serializer.data,
                },
                status=(
                    status.HTTP_201_CREATED
                ),
            )

        return Response(
            {
                "success": False,
                "errors": (
                    serializer.errors
                ),
            },
            status=(
                status.HTTP_400_BAD_REQUEST
            ),
        )


# ============================================================
# DELETE TEMPLATE
# ============================================================

@api_view(["DELETE"])
@permission_classes(
    [permissions.IsAuthenticated]
)
def delete_template(
    request,
    pk,
):
    try:

        (
            DocumentTemplate.objects
            .get(
                pk=pk,
                user=request.user,
            )
            .delete()
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Template deleted."
                ),
            }
        )

    except DocumentTemplate.DoesNotExist:

        return Response(
            {
                "success": False,
                "message": (
                    "Template not found."
                ),
            },
            status=(
                status.HTTP_404_NOT_FOUND
            ),
        )
