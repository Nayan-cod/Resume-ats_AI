from docling.document_converter import DocumentConverter

def parse_resume(file_path: str) -> str:
    """
    Parses a PDF resume using Docling and returns Markdown text.
    """
    try:
        converter = DocumentConverter()
        result = converter.convert(file_path)
        return result.document.export_to_markdown()
    except Exception as e:
        print(f"Error parsing resume: {e}")
        # Build in a fallback or just re-raise for now
        raise e
