from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import json
import os
import requests
from typing import List, Dict, Any
import PyPDF2
import io
import re
from datetime import datetime

app = FastAPI(title="NavigateHome.AI API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ollama API configuration
OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3.1"  # or "mistral", "codellama", etc.

# USCIS Forms database
USCIS_FORMS = {
    "I-485": {
        "name": "Application to Register Permanent Residence or Adjust Status",
        "description": "Form used to apply for a green card",
        "sections": [
            "Personal Information",
            "Immigration History", 
            "Family Information",
            "Criminal History",
            "Supporting Documents"
        ]
    },
    "I-130": {
        "name": "Petition for Alien Relative",
        "description": "Form to sponsor a family member for immigration",
        "sections": [
            "Petitioner Information",
            "Beneficiary Information",
            "Relationship Evidence",
            "Supporting Documents"
        ]
    },
    "I-765": {
        "name": "Application for Employment Authorization",
        "description": "Form to apply for work permit",
        "sections": [
            "Personal Information",
            "Immigration Status",
            "Employment Information",
            "Supporting Documents"
        ]
    },
    "I-821D": {
        "name": "Consideration of Deferred Action for Childhood Arrivals",
        "description": "DACA application form",
        "sections": [
            "Personal Information",
            "Entry Information",
            "Residence History",
            "Education Information",
            "Supporting Documents"
        ]
    },
    "N-400": {
        "name": "Application for Naturalization",
        "description": "Form to apply for US citizenship",
        "sections": [
            "Personal Information",
            "Residence Information",
            "Travel History",
            "Criminal History",
            "Supporting Documents"
        ]
    }
}

# LEQ Dataset - Long Essay Questions with simplified versions
LEQ_DATASET = {
    "I-485": [
        {
            "original": "Describe in detail your immigration history, including all entries into the United States, dates of entry, ports of entry, and immigration status at each entry.",
            "simplified": "Tell us about every time you came to the US - when, where, and what status you had each time.",
            "translation_key": "immigration_history_detail"
        },
        {
            "original": "Provide a complete account of your criminal history, including all arrests, charges, convictions, and any interactions with law enforcement agencies.",
            "simplified": "Have you ever been arrested, charged with a crime, or convicted? Tell us about any trouble with the police.",
            "translation_key": "criminal_history_complete"
        },
        {
            "original": "Explain the circumstances that led to your current immigration status and provide detailed documentation supporting your eligibility for adjustment of status.",
            "simplified": "Why do you qualify for a green card? What makes you eligible?",
            "translation_key": "eligibility_circumstances"
        }
    ],
    "I-130": [
        {
            "original": "Describe in detail the nature of your relationship with the beneficiary, including how you met, the development of your relationship, and evidence of a bona fide marriage or family relationship.",
            "simplified": "Tell us about your relationship with the person you're sponsoring. How did you meet? How do you know each other?",
            "translation_key": "relationship_nature_detail"
        },
        {
            "original": "Provide comprehensive documentation demonstrating the authenticity of your relationship, including financial co-mingling, shared residence, and ongoing communication.",
            "simplified": "Show us proof that your relationship is real - shared bills, living together, photos, messages, etc.",
            "translation_key": "relationship_authenticity_proof"
        }
    ],
    "I-765": [
        {
            "original": "Explain the basis for your employment authorization request, including your current immigration status and any pending applications that support your eligibility.",
            "simplified": "Why do you need permission to work? What's your current immigration status?",
            "translation_key": "employment_authorization_basis"
        },
        {
            "original": "Describe your employment history in the United States, including all previous jobs, employers, dates of employment, and any previous work authorization.",
            "simplified": "Tell us about all the jobs you've had in the US - where you worked, when, and if you had permission to work.",
            "translation_key": "employment_history_detail"
        }
    ],
    "I-821D": [
        {
            "original": "Describe in detail the circumstances of your entry into the United States, including the date, location, and method of entry, and provide any available documentation.",
            "simplified": "How did you come to the US? When did you arrive? Where did you enter? Do you have any papers from when you came?",
            "translation_key": "entry_circumstances_detail"
        },
        {
            "original": "Provide a complete residential history since your entry into the United States, including all addresses, dates of residence, and supporting documentation.",
            "simplified": "List all the places you've lived since coming to the US - addresses, dates, and proof of where you lived.",
            "translation_key": "residential_history_complete"
        },
        {
            "original": "Describe your educational background, including all schools attended, degrees obtained, and any educational achievements or certifications.",
            "simplified": "Tell us about your education - what schools you went to, any degrees or certificates you have.",
            "translation_key": "educational_background_detail"
        }
    ],
    "N-400": [
        {
            "original": "Describe your continuous residence in the United States, including any periods of absence and the reasons for such absences.",
            "simplified": "Tell us about living in the US continuously - have you left the country? If so, when and why?",
            "translation_key": "continuous_residence_detail"
        },
        {
            "original": "Provide a complete account of your travel history outside the United States, including all trips, dates, destinations, and purposes of travel.",
            "simplified": "List all trips you've taken outside the US - when, where, and why you went.",
            "translation_key": "travel_history_complete"
        },
        {
            "original": "Explain any interactions with law enforcement agencies, including arrests, charges, convictions, or any other legal proceedings.",
            "simplified": "Have you ever been arrested, charged with a crime, or had any legal problems? Tell us about it.",
            "translation_key": "law_enforcement_interactions"
        }
    ]
}

# Translation mappings for different languages
TRANSLATIONS = {
    "es": {
        "immigration_history_detail": "Cuéntanos sobre cada vez que viniste a los Estados Unidos - cuándo, dónde y qué estatus tenías cada vez.",
        "criminal_history_complete": "¿Alguna vez has sido arrestado, acusado de un delito o condenado? Cuéntanos sobre cualquier problema con la policía.",
        "eligibility_circumstances": "¿Por qué calificas para una tarjeta verde? ¿Qué te hace elegible?",
        "relationship_nature_detail": "Cuéntanos sobre tu relación con la persona que estás patrocinando. ¿Cómo se conocieron? ¿Cómo se conocen?",
        "employment_authorization_basis": "¿Por qué necesitas permiso para trabajar? ¿Cuál es tu estatus migratorio actual?",
        "entry_circumstances_detail": "¿Cómo llegaste a los Estados Unidos? ¿Cuándo llegaste? ¿Dónde entraste? ¿Tienes algún documento de cuando viniste?",
        "residential_history_complete": "Enumera todos los lugares donde has vivido desde que llegaste a los Estados Unidos - direcciones, fechas y prueba de dónde viviste.",
        "educational_background_detail": "Cuéntanos sobre tu educación - qué escuelas asististe, qué títulos o certificados tienes.",
        "continuous_residence_detail": "Cuéntanos sobre vivir continuamente en los Estados Unidos - ¿has salido del país? Si es así, ¿cuándo y por qué?",
        "travel_history_complete": "Enumera todos los viajes que has tomado fuera de los Estados Unidos - cuándo, dónde y por qué fuiste.",
        "law_enforcement_interactions": "¿Alguna vez has sido arrestado, acusado de un delito o tenido algún problema legal? Cuéntanos sobre eso."
    },
    "zh": {
        "immigration_history_detail": "告诉我们你每次来美国的情况 - 什么时候，在哪里，每次有什么身份。",
        "criminal_history_complete": "你曾经被逮捕、被指控犯罪或被定罪吗？告诉我们任何与警察的麻烦。",
        "eligibility_circumstances": "你为什么有资格获得绿卡？什么使你符合条件？",
        "relationship_nature_detail": "告诉我们你与被担保人的关系。你们是怎么认识的？你们怎么认识的？",
        "employment_authorization_basis": "你为什么需要工作许可？你目前的移民身份是什么？",
        "entry_circumstances_detail": "你是怎么来美国的？你什么时候到达的？你在哪里入境的？你来的时候有什么文件吗？",
        "residential_history_complete": "列出你来到美国后住过的所有地方 - 地址、日期和居住证明。",
        "educational_background_detail": "告诉我们你的教育背景 - 你上过什么学校，有什么学位或证书。",
        "continuous_residence_detail": "告诉我们你在美国的连续居住情况 - 你离开过国家吗？如果有，什么时候和为什么？",
        "travel_history_complete": "列出你在美国境外的所有旅行 - 什么时候，去哪里，为什么去。",
        "law_enforcement_interactions": "你曾经被逮捕、被指控犯罪或有过任何法律问题吗？告诉我们。"
    },
    "ar": {
        "immigration_history_detail": "أخبرنا عن كل مرة أتيت فيها إلى الولايات المتحدة - متى، أين، وما هي حالتك في كل مرة.",
        "criminal_history_complete": "هل تم اعتقالك أو اتهامك بجريمة أو إدانتك من قبل؟ أخبرنا عن أي مشاكل مع الشرطة.",
        "eligibility_circumstances": "لماذا تستحق البطاقة الخضراء؟ ما الذي يجعلك مؤهلاً؟",
        "relationship_nature_detail": "أخبرنا عن علاقتك مع الشخص الذي ترعاه. كيف التقيتما؟ كيف تعرفان بعضكما؟",
        "employment_authorization_basis": "لماذا تحتاج إذن للعمل؟ ما هي حالتك المهاجرة الحالية؟",
        "entry_circumstances_detail": "كيف أتيت إلى الولايات المتحدة؟ متى وصلت؟ أين دخلت؟ هل لديك أي أوراق من عندما أتيت؟",
        "residential_history_complete": "اذكر جميع الأماكن التي عشت فيها منذ مجيئك إلى الولايات المتحدة - العناوين والتواريخ وإثبات مكان إقامتك.",
        "educational_background_detail": "أخبرنا عن تعليمك - أي مدارس ذهبت إليها، أي درجات أو شهادات لديك.",
        "continuous_residence_detail": "أخبرنا عن العيش المستمر في الولايات المتحدة - هل غادرت البلد؟ إذا كان الأمر كذلك، متى ولماذا؟",
        "travel_history_complete": "اذكر جميع الرحلات التي قمت بها خارج الولايات المتحدة - متى، أين، ولماذا ذهبت.",
        "law_enforcement_interactions": "هل تم اعتقالك أو اتهامك بجريمة أو واجهت أي مشاكل قانونية من قبل؟ أخبرنا عن ذلك."
    }
}

def call_ollama(prompt: str, model: str = OLLAMA_MODEL) -> str:
    """Call Ollama API to process text"""
    try:
        url = f"{OLLAMA_BASE_URL}/api/generate"
        data = {
            "model": model,
            "prompt": prompt,
            "stream": False
        }
        
        response = requests.post(url, json=data, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        return result.get("response", "")
    except Exception as e:
        print(f"Error calling Ollama: {e}")
        return "I'm sorry, I'm having trouble processing your request right now. Please try again."

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
    
    for form_code in USCIS_FORMS.keys():
        if form_code in text_upper:
            return form_code
    
    return "Unknown"

def chunk_document(text: str) -> Dict[str, List[str]]:
    """Chunk document into LEQs and short answer questions"""
    leqs = []
    short_questions = []
    
    # Look for common LEQ patterns
    leq_patterns = [
        r"Describe in detail",
        r"Explain the circumstances",
        r"Provide a complete",
        r"Describe your",
        r"Explain any",
        r"Provide comprehensive"
    ]
    
    sentences = re.split(r'[.!?]+', text)
    
    for sentence in sentences:
        sentence = sentence.strip()
        if len(sentence) > 50:  # Likely a longer question
            for pattern in leq_patterns:
                if re.search(pattern, sentence, re.IGNORECASE):
                    leqs.append(sentence)
                    break
            else:
                if len(sentence) > 20:
                    short_questions.append(sentence)
        elif len(sentence) > 10:
            short_questions.append(sentence)
    
    return {
        "long_essay_questions": leqs,
        "short_answer_questions": short_questions
    }

def simplify_question_with_ollama(question: str) -> str:
    """Use Ollama to simplify complex immigration questions"""
    prompt = f"""
    You are an immigration expert helping non-native English speakers understand complex legal questions.
    
    Simplify this immigration form question into plain, simple English that anyone can understand:
    
    "{question}"
    
    Requirements:
    - Use simple words and short sentences
    - Avoid legal jargon
    - Make it conversational and friendly
    - Keep the same meaning but make it much easier to understand
    - Maximum 2 sentences
    
    Simplified version:
    """
    
    return call_ollama(prompt)

def translate_text_with_ollama(text: str, target_language: str) -> str:
    """Use Ollama to translate text to target language"""
    language_names = {
        "es": "Spanish",
        "zh": "Chinese", 
        "ar": "Arabic",
        "hi": "Hindi",
        "pt": "Portuguese",
        "ru": "Russian",
        "fr": "French",
        "vi": "Vietnamese",
        "ko": "Korean"
    }
    
    target_lang_name = language_names.get(target_language, target_language)
    
    prompt = f"""
    Translate the following text from English to {target_lang_name}.
    Keep the meaning and tone exactly the same.
    Make sure it's natural and easy to understand in {target_lang_name}.
    
    Text to translate: "{text}"
    
    Translation:
    """
    
    return call_ollama(prompt)

@app.get("/")
async def root():
    return {"message": "NavigateHome.AI API - Personal AI Caseworker for Immigrants"}

@app.get("/forms")
async def get_forms():
    """Get all available USCIS forms"""
    return {"forms": USCIS_FORMS}

@app.get("/forms/{form_code}")
async def get_form_details(form_code: str):
    """Get details for a specific form"""
    if form_code.upper() not in USCIS_FORMS:
        raise HTTPException(status_code=404, detail="Form not found")
    
    form_data = USCIS_FORMS[form_code.upper()]
    leqs = LEQ_DATASET.get(form_code.upper(), [])
    
    return {
        "form_code": form_code.upper(),
        "form_data": form_data,
        "long_essay_questions": leqs
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
        
        # Chunk document
        chunks = chunk_document(text)
        
        return {
            "filename": file.filename,
            "form_type": form_type,
            "text_length": len(text),
            "chunks": chunks,
            "status": "success"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

@app.post("/analyze-document")
async def analyze_document(request: dict):
    """Analyze document with AI and provide simplified explanations"""
    try:
        text = request.get("text", "")
        form_type = request.get("form_type", "Unknown")
        language = request.get("language", "en")
        
        if not text:
            raise HTTPException(status_code=400, detail="No text provided")
        
        # Chunk the document
        chunks = chunk_document(text)
        
        # Process LEQs with Ollama
        processed_leqs = []
        for leq in chunks["long_essay_questions"]:
            simplified = simplify_question_with_ollama(leq)
            
            # Translate if needed
            translated = simplified
            if language != "en":
                translated = translate_text_with_ollama(simplified, language)
            
            processed_leqs.append({
                "original": leq,
                "simplified": simplified,
                "translated": translated,
                "language": language
            })
        
        # Process short questions
        processed_short = []
        for question in chunks["short_answer_questions"][:10]:  # Limit to first 10
            simplified = simplify_question_with_ollama(question)
            
            translated = simplified
            if language != "en":
                translated = translate_text_with_ollama(simplified, language)
            
            processed_short.append({
                "original": question,
                "simplified": simplified,
                "translated": translated,
                "language": language
            })
        
        return {
            "form_type": form_type,
            "analysis": {
                "long_essay_questions": processed_leqs,
                "short_answer_questions": processed_short,
                "total_questions": len(processed_leqs) + len(processed_short)
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
    """Ask a question to the AI assistant"""
    try:
        question = request.get("question", "")
        context = request.get("context", "")
        language = request.get("language", "en")
        
        if not question:
            raise HTTPException(status_code=400, detail="No question provided")
        
        # Create context-aware prompt
        prompt = f"""
        You are NavigateHome.AI, a personal AI caseworker for immigrants. You help people navigate the complex US immigration system.
        
        Context: {context}
        
        User Question: {question}
        
        Provide a helpful, accurate, and empathetic response. Include:
        - Clear, simple explanations
        - Step-by-step guidance when appropriate
        - Relevant resources or next steps
        - Encouragement and support
        
        Keep your response conversational and easy to understand.
        """
        
        response = call_ollama(prompt)
        
        # Translate response if needed
        translated_response = response
        if language != "en":
            translated_response = translate_text_with_ollama(response, language)
        
        return {
            "question": question,
            "response": response,
            "translated_response": translated_response,
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
        
        translated_text = translate_text_with_ollama(text, target_language)
        
        return {
            "original_text": text,
            "translated_text": translated_text,
            "target_language": target_language,
            "status": "success"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error translating document: {str(e)}")

@app.get("/leq-dataset")
async def get_leq_dataset():
    """Get the complete LEQ dataset"""
    return {
        "leq_dataset": LEQ_DATASET,
        "translations": TRANSLATIONS,
        "total_forms": len(LEQ_DATASET),
        "total_leqs": sum(len(leqs) for leqs in LEQ_DATASET.values())
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test Ollama connection
        test_response = call_ollama("Hello, are you working?")
        ollama_status = "connected" if test_response else "disconnected"
        
        return {
            "status": "healthy",
            "ollama_status": ollama_status,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

if __name__ == "__main__":
    print("🚀 Starting NavigateHome.AI API...")
    print("📋 USCIS Forms loaded:", len(USCIS_FORMS))
    print("📝 LEQ Dataset loaded:", sum(len(leqs) for leqs in LEQ_DATASET.values()), "questions")
    print("🌍 Translation support for", len(TRANSLATIONS), "languages")
    print("🤖 Ollama endpoint:", OLLAMA_BASE_URL)
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
