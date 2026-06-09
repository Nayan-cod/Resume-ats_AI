from fpdf import FPDF

class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'John Doe - Software Engineer', 0, 1, 'C')
        self.ln(10)

def create_resume():
    pdf = PDF()
    pdf.add_page()
    pdf.set_font('Arial', '', 12)
    
    content = """
    Email: john.doe@example.com
    Phone: 123-456-7890
    
    Summary:
    Motivated Software Engineer with 1 year of experience in Python and Machine Learning.
    Eager to build intelligent systems.
    
    Education:
    Bachelor of Science in Computer Science, Tech University (2024)
    
    Skills:
    - Python, FastApi, SQL
    - Machine Learning: Scikit-learn, Pandas, NumPy
    - Basic Deep Learning
    - Git, GitHub
    
    Projects:
    1. Resume Matcher: Built an AI resume parser using Python and LLMs.
    2. Data Analyzer: Automated data cleaning pipeline using Pandas.
    """
    
    pdf.multi_cell(0, 10, content)
    pdf.output("test_resume.pdf")

if __name__ == "__main__":
    create_resume()
