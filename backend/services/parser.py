import pypdf

def parse_resume(file_path: str) -> str:
    """
    Parses a PDF resume using pypdf and returns text.
    """
    try:
        reader = pypdf.PdfReader(file_path)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text
    except Exception as e:
        print(f"Error parsing resume: {e}")
        raise e

