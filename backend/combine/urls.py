from django.urls import path

from .views import (
    PDFMergeView,
    ImageMergeView,
    ImageToPDFView,
    ImageConvertView,
    WordMergeView,
    PDFToWordView,
    PDFToExcelView,
    WordToPDFView,
    ExcelToPDFView,
    CompressPDFView,
    RotatePDFView,
    OrganizePDFView,
    WatermarkPDFView,
    SplitPDFView,
    PDFColorEnhanceView,
    NupPDFView,
    CombineListView,
    download_combined,
    delete_combined,
)


urlpatterns = [
    path(
        "pdf-merge/",
        PDFMergeView.as_view(),
        name="pdf-merge",
    ),

    path(
        "image-merge/",
        ImageMergeView.as_view(),
        name="image-merge",
    ),

    path(
        "image-to-pdf/",
        ImageToPDFView.as_view(),
        name="image-to-pdf",
    ),

    path(
        "image-convert/",
        ImageConvertView.as_view(),
        name="image-convert",
    ),

    path(
        "word-merge/",
        WordMergeView.as_view(),
        name="word-merge",
    ),

    path(
        "pdf-to-word/",
        PDFToWordView.as_view(),
        name="pdf-to-word",
    ),

    path(
        "pdf-to-excel/",
        PDFToExcelView.as_view(),
        name="pdf-to-excel",
    ),

    path(
        "word-to-pdf/",
        WordToPDFView.as_view(),
        name="word-to-pdf",
    ),

    # =========================================================
    # EXCEL TO PDF
    # =========================================================
    path(
        "excel-to-pdf/",
        ExcelToPDFView.as_view(),
        name="excel-to-pdf",
    ),

    path(
        "compress-pdf/",
        CompressPDFView.as_view(),
        name="compress-pdf",
    ),

    path(
        "rotate-pdf/",
        RotatePDFView.as_view(),
        name="rotate-pdf",
    ),

    # =========================================================
    # ORGANIZE PDF
    # =========================================================
    path(
        "organize-pdf/",
        OrganizePDFView.as_view(),
        name="organize-pdf",
    ),

    path(
        "watermark-pdf/",
        WatermarkPDFView.as_view(),
        name="watermark-pdf",
    ),

    path(
        "split-pdf/",
        SplitPDFView.as_view(),
        name="split-pdf",
    ),

    path(
        "pdf-color-enhance/",
        PDFColorEnhanceView.as_view(),
        name="pdf-color-enhance",
    ),

    path(
        "nup-pdf/",
        NupPDFView.as_view(),
        name="nup-pdf",
    ),

    path(
        "history/",
        CombineListView.as_view(),
        name="combine-history",
    ),

    path(
        "<uuid:pk>/download/",
        download_combined,
        name="download-combined",
    ),

    path(
        "<uuid:pk>/delete/",
        delete_combined,
        name="delete-combined",
    ),
]