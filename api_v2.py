from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import json
import os
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
import PyPDF2
import io

app = FastAPI(title="NavigateHome.AI API", version="2.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# NavigateHome AI Document Parser System
class NavigateHomeAI:
    def __init__(self):
        self.forms_data = self.load_forms_data()
        self.translations = self.load_translations()
        
    def load_forms_data(self):
        """Load sample immigration forms data"""
        return {
            "I-485": {
                "name": "Application to Register Permanent Residence or Adjust Status",
                "description": "Form used to apply for a green card",
                "sections": [
                    {
                        "sectionTitle": "Information About You",
                        "questions": [
                            {
                                "id": "i485_1",
                                "originalQuestion": "Provide your full legal name as it appears on your birth certificate or other official documents.",
                                "simplifiedQuestion": "What is your full legal name? (The name on your birth certificate)",
                                "type": "short",
                                "helpText": "Use the exact name from your birth certificate or passport",
                                "requiredDocuments": ["Birth certificate", "Passport"],
                                "commonMistakes": ["Using nickname instead of legal name", "Missing middle name"]
                            },
                            {
                                "id": "i485_2", 
                                "originalQuestion": "Provide all other names you have ever used, including aliases, maiden name, and names from previous marriages.",
                                "simplifiedQuestion": "Have you ever used a different name? (Like a nickname, maiden name, or name from a previous marriage?)",
                                "type": "short",
                                "helpText": "Include any names you've used in the past",
                                "requiredDocuments": ["Marriage certificates", "Name change documents"],
                                "commonMistakes": ["Forgetting maiden name", "Not listing all previous names"]
                            },
                            {
                                "id": "i485_3",
                                "originalQuestion": "Describe in detail the circumstances of your entry into the United States, including the date, location, and method of entry.",
                                "simplifiedQuestion": "How did you come to the United States? When did you arrive? Where did you enter?",
                                "type": "long",
                                "helpText": "Tell us exactly how, when, and where you entered the US",
                                "requiredDocuments": ["Passport", "I-94 record", "Entry stamps"],
                                "commonMistakes": ["Wrong dates", "Missing entry location", "Unclear method of entry"]
                            }
                        ]
                    },
                    {
                        "sectionTitle": "Immigration History",
                        "questions": [
                            {
                                "id": "i485_4",
                                "originalQuestion": "Provide a complete account of your immigration history, including all entries into the United States, dates of entry, ports of entry, and immigration status at each entry.",
                                "simplifiedQuestion": "Tell us about every time you came to the US - when, where, and what status you had each time.",
                                "type": "long",
                                "helpText": "List every trip to the US with dates and locations",
                                "requiredDocuments": ["Passport stamps", "I-94 records", "Visa documents"],
                                "commonMistakes": ["Missing trips", "Wrong dates", "Incorrect status"]
                            }
                        ]
                    }
                ]
            },
            "N-400": {
                "name": "Application for Naturalization",
                "description": "Form to apply for US citizenship",
                "sections": [
                    {
                        "sectionTitle": "Personal Information",
                        "questions": [
                            {
                                "id": "n400_1",
                                "originalQuestion": "Provide your full legal name as it appears on your Permanent Resident Card (Green Card).",
                                "simplifiedQuestion": "What is your full legal name? (The name on your green card)",
                                "type": "short",
                                "helpText": "Use the exact name from your green card",
                                "requiredDocuments": ["Green card"],
                                "commonMistakes": ["Using different spelling", "Missing middle name"]
                            },
                            {
                                "id": "n400_2",
                                "originalQuestion": "Describe your continuous residence in the United States, including any periods of absence and the reasons for such absences.",
                                "simplifiedQuestion": "Tell us about living in the US continuously - have you left the country? If so, when and why?",
                                "type": "long",
                                "helpText": "Explain any trips outside the US and why you took them",
                                "requiredDocuments": ["Travel records", "Employment records"],
                                "commonMistakes": ["Not explaining long trips", "Missing travel dates"]
                            }
                        ]
                    }
                ]
            },
            "I-130": {
                "name": "Petition for Alien Relative",
                "description": "Form to sponsor a family member for immigration",
                "sections": [
                    {
                        "sectionTitle": "Petitioner Information",
                        "questions": [
                            {
                                "id": "i130_1",
                                "originalQuestion": "Describe in detail the nature of your relationship with the beneficiary, including how you met, the development of your relationship, and evidence of a bona fide marriage or family relationship.",
                                "simplifiedQuestion": "Tell us about your relationship with the person you're sponsoring. How did you meet? How do you know each other?",
                                "type": "long",
                                "helpText": "Explain your relationship and how it developed",
                                "requiredDocuments": ["Marriage certificate", "Photos", "Joint documents"],
                                "commonMistakes": ["Not enough detail", "Missing relationship evidence"]
                            }
                        ]
                    }
                ]
            }
        }
    
    def load_translations(self):
        """Load translation mappings for different languages"""
        return {
            "es": {
                "i485_1": "¿Cuál es tu nombre legal completo? (El nombre en tu certificado de nacimiento)",
                "i485_2": "¿Alguna vez has usado un nombre diferente? (Como un apodo, nombre de soltera, o nombre de un matrimonio anterior?)",
                "i485_3": "¿Cómo llegaste a los Estados Unidos? ¿Cuándo llegaste? ¿Dónde entraste?",
                "i485_4": "Cuéntanos sobre cada vez que viniste a los Estados Unidos - cuándo, dónde y qué estatus tenías cada vez.",
                "n400_1": "¿Cuál es tu nombre legal completo? (El nombre en tu tarjeta verde)",
                "n400_2": "Cuéntanos sobre vivir continuamente en los Estados Unidos - ¿has salido del país? Si es así, ¿cuándo y por qué?",
                "i130_1": "Cuéntanos sobre tu relación con la persona que estás patrocinando. ¿Cómo se conocieron? ¿Cómo se conocen?"
            },
            "zh": {
                "i485_1": "你的完整法定姓名是什么？（出生证明上的姓名）",
                "i485_2": "你曾经使用过不同的姓名吗？（比如昵称、婚前姓名或前一段婚姻的姓名？）",
                "i485_3": "你是怎么来到美国的？什么时候到达的？在哪里入境的？",
                "i485_4": "告诉我们你每次来美国的情况 - 什么时候，在哪里，每次有什么身份。",
                "n400_1": "你的完整法定姓名是什么？（绿卡上的姓名）",
                "n400_2": "告诉我们你在美国的连续居住情况 - 你离开过国家吗？如果有，什么时候和为什么？",
                "i130_1": "告诉我们你与被担保人的关系。你们是怎么认识的？你们怎么认识的？"
            },
            "ar": {
                "i485_1": "ما هو اسمك القانوني الكامل؟ (الاسم في شهادة الميلاد)",
                "i485_2": "هل استخدمت اسمًا مختلفًا من قبل؟ (مثل لقب، اسم العائلة، أو اسم من زواج سابق؟)",
                "i485_3": "كيف أتيت إلى الولايات المتحدة؟ متى وصلت؟ أين دخلت؟",
                "i485_4": "أخبرنا عن كل مرة أتيت فيها إلى الولايات المتحدة - متى، أين، وما هي حالتك في كل مرة.",
                "n400_1": "ما هو اسمك القانوني الكامل؟ (الاسم في البطاقة الخضراء)",
                "n400_2": "أخبرنا عن العيش المستمر في الولايات المتحدة - هل غادرت البلد؟ إذا كان الأمر كذلك، متى ولماذا؟",
                "i130_1": "أخبرنا عن علاقتك مع الشخص الذي ترعاه. كيف التقيتما؟ كيف تعرفان بعضكما؟"
            }
        }
    
    def parse_immigration_document(self, form_text: str, form_number: str) -> Dict[str, Any]:
        """Parse immigration document and extract structured questions"""
        try:
            if form_number not in self.forms_data:
                return {"error": f"Form {form_number} not found"}
            
            form_data = self.forms_data[form_number]
            
            # Simulate AI parsing by returning structured data
            parsed_document = {
                "formNumber": form_number,
                "formName": form_data["name"],
                "formDescription": form_data["description"],
                "sections": form_data["sections"],
                "totalQuestions": sum(len(section["questions"]) for section in form_data["sections"]),
                "parsedAt": datetime.now().isoformat()
            }
            
            return parsed_document
            
        except Exception as e:
            return {"error": f"Error parsing document: {str(e)}"}
    
    def simplify_question(self, original_question: str) -> str:
        """Simplify complex legal language to 6th-grade reading level"""
        # This is a simplified version - in production, this would use AI
        simplifications = {
            "Provide your full legal name as it appears on your birth certificate or other official documents.": "What is your full legal name? (The name on your birth certificate)",
            "Provide all other names you have ever used, including aliases, maiden name, and names from previous marriages.": "Have you ever used a different name? (Like a nickname, maiden name, or name from a previous marriage?)",
            "Describe in detail the circumstances of your entry into the United States, including the date, location, and method of entry.": "How did you come to the United States? When did you arrive? Where did you enter?",
            "Provide a complete account of your immigration history, including all entries into the United States, dates of entry, ports of entry, and immigration status at each entry.": "Tell us about every time you came to the US - when, where, and what status you had each time.",
            "Describe your continuous residence in the United States, including any periods of absence and the reasons for such absences.": "Tell us about living in the US continuously - have you left the country? If so, when and why?",
            "Describe in detail the nature of your relationship with the beneficiary, including how you met, the development of your relationship, and evidence of a bona fide marriage or family relationship.": "Tell us about your relationship with the person you're sponsoring. How did you meet? How do you know each other?"
        }
        
        return simplifications.get(original_question, original_question)
    
    def batch_translate_questions(self, questions: List[Dict], target_language: str) -> List[Dict]:
        """Translate simplified questions into user's native language"""
        if target_language == "en":
            return questions
        
        translations = self.translations.get(target_language, {})
        
        translated_questions = []
        for question in questions:
            translated_question = question.copy()
            question_id = question.get("id", "")
            
            if question_id in translations:
                translated_question["simplifiedQuestion"] = translations[question_id]
                translated_question["translatedLanguage"] = target_language
            
            translated_questions.append(translated_question)
        
        return translated_questions
    
    def chunk_document(self, questions: List[Dict]) -> Dict[str, List[Dict]]:
        """Categorize questions into short and long answer types"""
        short_questions = []
        long_questions = []
        
        for question in questions:
            if question.get("type") == "short":
                short_questions.append(question)
            else:
                long_questions.append(question)
        
        return {
            "shortAnswerQuestions": short_questions,
            "longAnswerQuestions": long_questions
        }
    
    def generate_help_text(self, question: Dict) -> str:
        """Generate contextual help for a question"""
        help_parts = []
        
        if question.get("helpText"):
            help_parts.append(f"💡 {question['helpText']}")
        
        if question.get("requiredDocuments"):
            docs = ", ".join(question["requiredDocuments"])
            help_parts.append(f"📄 Documents needed: {docs}")
        
        if question.get("commonMistakes"):
            mistakes = ", ".join(question["commonMistakes"])
            help_parts.append(f"⚠️ Common mistakes: {mistakes}")
        
        return "\n".join(help_parts) if help_parts else "No additional help available."
    
    def generate_ai_response(self, question: str, context: str = "", language: str = "en") -> str:
        """Generate AI response for chat interface"""
        question_lower = question.lower()
        
        # Immigration form responses
        if any(form in question_lower for form in ["i-485", "i485", "green card"]):
            return """**I-485 Green Card Application Help:**

📋 **Form Overview:**
The I-485 is used to apply for a green card (permanent residence) in the United States.

🔍 **Key Questions Simplified:**

1. **Personal Information:**
   - "What is your full legal name?" (Use birth certificate name)
   - "Have you used other names?" (Include maiden name, nicknames)

2. **Immigration History:**
   - "How did you come to the US?" (Entry method, date, location)
   - "Tell us about all your trips to the US" (Complete travel history)

💡 **Tips:**
- Be completely honest about your immigration history
- Gather all required documents before starting
- Double-check dates and locations
- Consider getting legal help for complex cases

**Would you like me to help you with a specific section of the I-485?**"""

        elif any(form in question_lower for form in ["n-400", "n400", "citizenship", "naturalization"]):
            return """**N-400 Citizenship Application Help:**

📋 **Form Overview:**
The N-400 is used to apply for US citizenship through naturalization.

🔍 **Key Questions Simplified:**

1. **Personal Information:**
   - "What is your full legal name?" (Use green card name)
   - "Tell us about living continuously in the US" (Explain any trips abroad)

2. **Residence Requirements:**
   - Must have lived in US for 5 years (3 years if married to US citizen)
   - Must have been physically present for at least 30 months

💡 **Tips:**
- Keep detailed records of all travel outside the US
- Maintain continuous residence (don't stay abroad too long)
- Study for the civics test
- Practice English if needed

**Would you like help with a specific part of the N-400?**"""

        elif any(form in question_lower for form in ["i-130", "i130", "family petition", "sponsor"]):
            return """**I-130 Family Petition Help:**

📋 **Form Overview:**
The I-130 is used to sponsor a family member for immigration to the US.

🔍 **Key Questions Simplified:**

1. **Relationship Information:**
   - "Tell us about your relationship" (How you met, relationship development)
   - "Provide evidence of your relationship" (Photos, joint documents, etc.)

2. **Petitioner Information:**
   - Must be a US citizen or permanent resident
   - Must prove ability to financially support the beneficiary

💡 **Tips:**
- Gather lots of relationship evidence (photos, joint accounts, etc.)
- Include affidavits from friends and family
- Be prepared for interviews
- Consider getting legal help for complex cases

**Would you like help with gathering relationship evidence?**"""

        elif any(word in question_lower for word in ["help", "assistance", "guidance"]):
            return """**I'm here to help with your immigration journey!**

🤖 **What I can do:**
- Parse and simplify immigration forms
- Translate questions into your native language
- Explain complex legal requirements
- Provide step-by-step guidance
- Help with document preparation

📋 **Available Forms:**
- **I-485**: Green Card Application
- **N-400**: Citizenship Application  
- **I-130**: Family Petition

🌍 **Language Support:**
I can help in English, Spanish, Chinese, Arabic, and more!

**What would you like help with today?**"""

        else:
            return """**I understand you're asking about immigration. I'm your NavigateHome AI assistant!**

🤖 **I can help you with:**
- Understanding immigration forms
- Simplifying complex questions
- Translating documents
- Step-by-step guidance
- Document preparation

📋 **Try asking:**
- "Help me with form I-485"
- "I need help with citizenship"
- "How do I sponsor my family?"
- "Translate this question to Spanish"

**What specific immigration help do you need?**"""

# Initialize NavigateHome AI
navigatehome_ai = NavigateHomeAI()

def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text from PDF file"""
    try:
        pdf_file = io.BytesIO(file_content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        
        return text
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        return ""

def identify_form_type(text: str) -> str:
    """Identify the USCIS form type from text"""
    text_upper = text.upper()
    
    form_patterns = {
        "I-485": ["I-485", "I485", "ADJUSTMENT OF STATUS", "PERMANENT RESIDENCE"],
        "N-400": ["N-400", "N400", "NATURALIZATION", "CITIZENSHIP"],
        "I-130": ["I-130", "I130", "PETITION FOR ALIEN RELATIVE", "FAMILY PETITION"]
    }
    
    for form_code, patterns in form_patterns.items():
        if any(pattern in text_upper for pattern in patterns):
            return form_code
    
    return "Unknown"

@app.get("/")
async def root():
    return {"message": "NavigateHome.AI API - Immigration Document Parser", "version": "2.0.0"}

@app.get("/forms")
async def get_forms():
    """Get all available USCIS forms"""
    forms_summary = {}
    for form_code, form_data in navigatehome_ai.forms_data.items():
        forms_summary[form_code] = {
            "name": form_data["name"],
            "description": form_data["description"],
            "totalSections": len(form_data["sections"]),
            "totalQuestions": sum(len(section["questions"]) for section in form_data["sections"])
        }
    return {"forms": forms_summary}

@app.get("/forms/{form_code}")
async def get_form_details(form_code: str):
    """Get details for a specific form"""
    if form_code.upper() not in navigatehome_ai.forms_data:
        raise HTTPException(status_code=404, detail="Form not found")
    
    form_data = navigatehome_ai.forms_data[form_code.upper()]
    return {
        "form_code": form_code.upper(),
        "form_data": form_data
    }

@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload and process a PDF document"""
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        # Read file content
        content = await file.read()
        
        # Extract text from PDF
        text = extract_text_from_pdf(content)
        
        if not text:
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        
        # Identify form type
        form_type = identify_form_type(text)
        
        return {
            "filename": file.filename,
            "form_type": form_type,
            "text_length": len(text),
            "status": "success"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

@app.post("/analyze-document")
async def analyze_document(request: dict):
    """Analyze document with NavigateHome AI and provide simplified explanations"""
    try:
        form_type = request.get("form_type", "Unknown")
        language = request.get("language", "en")
        
        if form_type == "Unknown" or form_type not in navigatehome_ai.forms_data:
            raise HTTPException(status_code=400, detail="Form type not supported")
        
        # Parse the document
        parsed_document = navigatehome_ai.parse_immigration_document("", form_type)
        
        if "error" in parsed_document:
            raise HTTPException(status_code=400, detail=parsed_document["error"])
        
        # Extract all questions
        all_questions = []
        for section in parsed_document["sections"]:
            all_questions.extend(section["questions"])
        
        # Translate questions if needed
        translated_questions = navigatehome_ai.batch_translate_questions(all_questions, language)
        
        # Chunk questions by type
        chunked_questions = navigatehome_ai.chunk_document(translated_questions)
        
        return {
            "form_type": form_type,
            "form_name": parsed_document["formName"],
            "analysis": {
                "long_essay_questions": chunked_questions["longAnswerQuestions"],
                "short_answer_questions": chunked_questions["shortAnswerQuestions"],
                "total_questions": len(all_questions)
            },
            "recommendations": [
                "Complete personal information first",
                "Gather supporting documents for long essay questions",
                "Review each question carefully before answering",
                "Use simplified versions for better understanding"
            ],
            "status": "success"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing document: {str(e)}")

@app.post("/ask-question")
async def ask_question(request: dict):
    """Ask a question to the NavigateHome AI assistant"""
    try:
        question = request.get("question", "")
        context = request.get("context", "")
        language = request.get("language", "en")
        
        if not question:
            raise HTTPException(status_code=400, detail="No question provided")
        
        # Generate AI response
        response = navigatehome_ai.generate_ai_response(question, context, language)
        
        return {
            "question": question,
            "response": response,
            "language": language,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing question: {str(e)}")

@app.post("/translate-document")
async def translate_document(request: dict):
    """Translate document content to target language"""
    try:
        text = request.get("text", "")
        target_language = request.get("language", "es")
        
        if not text:
            raise HTTPException(status_code=400, detail="No text provided")
        
        # Simple translation simulation - in production, this would use AI
        translated_text = f"[Translated to {target_language.upper()}] {text}"
        
        return {
            "original_text": text,
            "translated_text": translated_text,
            "target_language": target_language,
            "status": "success"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error translating document: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "ai_system": "NavigateHome AI Document Parser",
        "version": "2.0.0",
        "forms_loaded": len(navigatehome_ai.forms_data),
        "languages_supported": len(navigatehome_ai.translations),
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    print("🚀 Starting NavigateHome.AI API v2.0...")
    print("📋 Forms loaded:", len(navigatehome_ai.forms_data))
    print("🌍 Languages supported:", len(navigatehome_ai.translations))
    print("🤖 AI System: NavigateHome AI Document Parser")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
