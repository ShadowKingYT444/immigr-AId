// Global variables
let currentLanguage = 'en';
let currentSection = 'dashboard';
let userProfile = {};
let profileComplete = false;
let chatHistory = [];
let currentChatId = null;
let recognition = null;
let isRecording = false;
let realUSCISForms = null;
let backendAPI = 'http://localhost:8000';
let currentDocumentId = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    await loadRealUSCISForms();
    await checkBackendConnection();
    initializeApp();
});

function initializeApp() {
    // Load saved preferences
    loadPreferences();
    
    // Initialize navigation
    initializeNavigation();
    
    // Initialize sections
    populatePathways();
    populateDocuments();
    populateHelpResources();
    
    // Initialize speech recognition
    initializeSpeechRecognition();
    
    // Initialize language selector
    initializeLanguageSelector();
    
    // Show welcome message
    showWelcomeMessage();
}

// Navigation Functions
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navMenu = document.getElementById('navMenu');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('data-section');
            showSection(section);
            
            // Close mobile menu if open
            navMenu.classList.remove('active');
        });
    });
    
    mobileMenuToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });
}

function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
        currentSection = sectionName;
    }
    
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Language Functions
function initializeLanguageSelector() {
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        languageSelect.addEventListener('change', (e) => {
            updateLanguage(e.target.value);
        });
    }
}

function updateLanguage(language) {
    currentLanguage = language;
    const t = translations[currentLanguage] || translations.en;
    
    // Update all text content
    updateAllTextContent(t);
    
    // Save language preference
    localStorage.setItem('preferredLanguage', language);
    
    // Show language change notification
    showNotification(`Language changed to ${t.languageName || language}`, 'success');
}

function updateAllTextContent(t) {
    // Update navigation
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (t[key]) {
            element.textContent = t[key];
        }
    });
    
    // Update form labels
    updateFormLabels(t);
    
    // Update placeholders
    updatePlaceholders(t);
}

function updateFormLabels(t) {
    const labelMap = {
        'firstName': t.firstNameLabel || 'First Name',
        'lastName': t.lastNameLabel || 'Last Name',
        'middleName': t.middleNameLabel || 'Middle Name',
        'dateOfBirth': t.dateOfBirthLabel || 'Date of Birth',
        'countryOfBirth': t.countryOfBirthLabel || 'Country of Birth',
        'currentAddress': t.currentAddressLabel || 'Current Address',
        'phoneNumber': t.phoneNumberLabel || 'Phone Number',
        'emailAddress': t.emailAddressLabel || 'Email Address',
        'socialSecurityNumber': t.socialSecurityNumberLabel || 'Social Security Number',
        'entryDate': t.entryDateLabel || 'Entry Date to US',
        'methodOfEntry': t.methodOfEntryLabel || 'Method of Entry',
        'educationLevel': t.educationLevelLabel || 'Education Level',
        'employmentStatus': t.employmentStatusLabel || 'Employment Status',
        'criminalHistory': t.criminalHistoryLabel || 'Criminal History'
    };
    
    Object.entries(labelMap).forEach(([id, text]) => {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) {
            label.textContent = text + (['firstName', 'lastName', 'dateOfBirth', 'countryOfBirth', 'currentAddress', 'phoneNumber', 'emailAddress', 'entryDate', 'methodOfEntry', 'educationLevel', 'employmentStatus'].includes(id) ? ' *' : '');
        }
    });
}

function updatePlaceholders(t) {
    const placeholderMap = {
        'messageInput': t.messagePlaceholder || 'Ask me anything about your immigration case...',
        'firstName': t.firstNamePlaceholder || 'Enter your first name',
        'lastName': t.lastNamePlaceholder || 'Enter your last name',
        'currentAddress': t.addressPlaceholder || 'Enter your current address'
    };
    
    Object.entries(placeholderMap).forEach(([id, placeholder]) => {
        const element = document.getElementById(id);
        if (element) {
            element.placeholder = placeholder;
        }
    });
}

// Backend API Integration Functions
async function checkBackendConnection() {
    try {
        const response = await fetch(`${backendAPI}/`);
        if (response.ok) {
            const data = await response.json();
            console.log('Backend API connected:', data.message);
            return true;
        }
    } catch (error) {
        console.warn('Backend API not available:', error.message);
    }
    return false;
}

async function uploadDocumentToBackend(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${backendAPI}/upload-pdf`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            currentDocumentId = result.document_id;
            console.log('Document uploaded to backend:', result);
            return result;
        } else {
            throw new Error(`Upload failed: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error uploading document:', error);
        throw error;
    }
}

async function analyzeDocumentWithAI(analysisType = 'comprehensive', questions = null) {
    if (!currentDocumentId) {
        throw new Error('No document uploaded');
    }
    
    try {
        const requestBody = {
            document_id: currentDocumentId,
            analysis_type: analysisType,
            questions: questions
        };
        
        const response = await fetch(`${backendAPI}/analyze-document`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Document analysis completed:', result);
            return result;
        } else {
            throw new Error(`Analysis failed: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error analyzing document:', error);
        throw error;
    }
}

async function askQuestionAboutDocument(question) {
    if (!currentDocumentId) {
        throw new Error('No document uploaded');
    }
    
    try {
        const requestBody = {
            document_id: currentDocumentId,
            question: question
        };
        
        const response = await fetch(`${backendAPI}/ask-question`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Question answered:', result);
            return result;
        } else {
            throw new Error(`Question failed: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error asking question:', error);
        throw error;
    }
}

// Load real USCIS forms data
async function loadRealUSCISForms() {
    try {
        const response = await fetch('uscis_all_forms.json');
        if (response.ok) {
            realUSCISForms = await response.json();
            console.log('Loaded', realUSCISForms.length, 'real USCIS forms');
            return true;
        } else {
            console.warn('Could not load real USCIS forms, using fallback data');
            return false;
        }
    } catch (error) {
        console.warn('Error loading real USCIS forms:', error);
        return false;
    }
}

// Immigration Pathways and Required Forms
const immigrationPathways = {
    'daca': {
        name: 'DACA (Deferred Action for Childhood Arrivals)',
        description: 'For undocumented individuals who came to the US as children',
        status: 'Currently limited due to court rulings',
        requiredForms: [
            { id: 'i-821d', name: 'Form I-821D - DACA Application', priority: 'high', status: 'pending' },
            { id: 'i-765', name: 'Form I-765 - Employment Authorization', priority: 'high', status: 'pending' },
            { id: 'i-131', name: 'Form I-131 - Advance Parole (if needed)', priority: 'medium', status: 'pending' },
            { id: 'g-1145', name: 'Form G-1145 - E-Notification', priority: 'low', status: 'pending' }
        ],
        eligibility: 'Arrived before age 16, continuous residence since 2007, education/military requirements',
        risks: 'No permanent status, subject to policy changes'
    },
    'asylum': {
        name: 'Asylum',
        description: 'For individuals fleeing persecution in their home country',
        status: 'Available for those with credible fear',
        requiredForms: [
            { id: 'i-589', name: 'Form I-589 - Asylum Application', priority: 'high', status: 'pending' },
            { id: 'i-765', name: 'Form I-765 - Employment Authorization (after 150 days)', priority: 'high', status: 'pending' },
            { id: 'i-131', name: 'Form I-131 - Refugee Travel Document', priority: 'medium', status: 'pending' },
            { id: 'g-1145', name: 'Form G-1145 - E-Notification', priority: 'low', status: 'pending' }
        ],
        eligibility: 'Fear of persecution based on race, religion, nationality, political opinion, or membership in social group',
        risks: 'Must prove persecution, strict deadlines, potential detention'
    },
    'family_based': {
        name: 'Family-Based Immigration',
        description: 'For family members of US citizens or lawful permanent residents',
        status: 'Available with varying wait times',
        requiredForms: [
            { id: 'i-130', name: 'Form I-130 - Petition for Alien Relative', priority: 'high', status: 'pending' },
            { id: 'i-485', name: 'Form I-485 - Adjustment of Status (if in US)', priority: 'high', status: 'pending' },
            { id: 'i-864', name: 'Form I-864 - Affidavit of Support', priority: 'high', status: 'pending' },
            { id: 'i-693', name: 'Form I-693 - Medical Examination', priority: 'high', status: 'pending' },
            { id: 'i-765', name: 'Form I-765 - Employment Authorization', priority: 'medium', status: 'pending' },
            { id: 'i-131', name: 'Form I-131 - Advance Parole', priority: 'medium', status: 'pending' },
            { id: 'g-1145', name: 'Form G-1145 - E-Notification', priority: 'low', status: 'pending' }
        ],
        eligibility: 'Immediate relatives (spouse, parent, child under 21) or family preference categories',
        risks: 'Long wait times for some categories, public charge considerations'
    },
    'employment_based': {
        name: 'Employment-Based Immigration',
        description: 'For skilled workers, professionals, and investors',
        status: 'Available with varying wait times',
        requiredForms: [
            { id: 'i-140', name: 'Form I-140 - Immigrant Petition for Alien Worker', priority: 'high', status: 'pending' },
            { id: 'i-485', name: 'Form I-485 - Adjustment of Status', priority: 'high', status: 'pending' },
            { id: 'i-864', name: 'Form I-864 - Affidavit of Support', priority: 'high', status: 'pending' },
            { id: 'i-693', name: 'Form I-693 - Medical Examination', priority: 'high', status: 'pending' },
            { id: 'i-765', name: 'Form I-765 - Employment Authorization', priority: 'medium', status: 'pending' },
            { id: 'i-131', name: 'Form I-131 - Advance Parole', priority: 'medium', status: 'pending' },
            { id: 'g-1145', name: 'Form G-1145 - E-Notification', priority: 'low', status: 'pending' }
        ],
        eligibility: 'EB-1 (extraordinary ability), EB-2 (advanced degree), EB-3 (skilled workers), EB-5 (investors)',
        risks: 'Labor certification required, strict requirements, long processing times'
    },
    'naturalization': {
        name: 'Naturalization (Citizenship)',
        description: 'For lawful permanent residents seeking US citizenship',
        status: 'Available for eligible LPRs',
        requiredForms: [
            { id: 'n-400', name: 'Form N-400 - Application for Naturalization', priority: 'high', status: 'pending' },
            { id: 'g-1145', name: 'Form G-1145 - E-Notification', priority: 'low', status: 'pending' }
        ],
        eligibility: '5 years as LPR (3 if married to US citizen), good moral character, English/civics test',
        risks: 'Must maintain good moral character, pass tests, continuous residence requirement'
    },
    'tps': {
        name: 'Temporary Protected Status (TPS)',
        description: 'For nationals of designated countries due to conflict or disaster',
        status: 'Available for designated countries',
        requiredForms: [
            { id: 'i-821', name: 'Form I-821 - TPS Application', priority: 'high', status: 'pending' },
            { id: 'i-765', name: 'Form I-765 - Employment Authorization', priority: 'high', status: 'pending' },
            { id: 'g-1145', name: 'Form G-1145 - E-Notification', priority: 'low', status: 'pending' }
        ],
        eligibility: 'National of designated country, continuous residence, no serious criminal record',
        risks: 'Temporary status only, subject to country designation changes'
    }
};

// Pathway Selection Functions
function populatePathways() {
    const pathwayGrid = document.getElementById('pathwayGrid');
    if (!pathwayGrid) return;
    
    pathwayGrid.innerHTML = '';
    
    Object.keys(immigrationPathways).forEach(pathwayKey => {
        const pathway = immigrationPathways[pathwayKey];
        const pathwayCard = createPathwayCard(pathwayKey, pathway);
        pathwayGrid.appendChild(pathwayCard);
    });
}

function createPathwayCard(pathwayKey, pathway) {
    const card = document.createElement('div');
    card.className = 'pathway-card';
    card.onclick = () => selectPathway(pathwayKey);
    
    let statusClass = 'available';
    if (pathway.status.includes('limited') || pathway.status.includes('court')) {
        statusClass = 'limited';
    } else if (pathway.status.includes('cap') || pathway.status.includes('restricted')) {
        statusClass = 'restricted';
    }
    
    card.innerHTML = `
        <div class="pathway-name">${pathway.name}</div>
        <div class="pathway-description">${pathway.description}</div>
        <div class="pathway-status ${statusClass}">${pathway.status}</div>
    `;
    
    return card;
}

function selectPathway(pathwayKey) {
    const pathway = immigrationPathways[pathwayKey];
    if (!pathway) return;
    
    // Remove selected class from all cards
    document.querySelectorAll('.pathway-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Add selected class to clicked card
    event.currentTarget.classList.add('selected');
    
    // Show pathway details
    const pathwayDetails = document.getElementById('pathwayDetails');
    const selectedPathwayName = document.getElementById('selectedPathwayName');
    const selectedPathwayDescription = document.getElementById('selectedPathwayDescription');
    const pathwayStatus = document.getElementById('pathwayStatus');
    const pathwayEligibility = document.getElementById('pathwayEligibility');
    const pathwayRisks = document.getElementById('pathwayRisks');
    const requiredFormsContainer = document.getElementById('requiredFormsContainer');
    
    selectedPathwayName.textContent = pathway.name;
    selectedPathwayDescription.textContent = pathway.description;
    pathwayStatus.textContent = pathway.status;
    pathwayEligibility.textContent = pathway.eligibility;
    pathwayRisks.textContent = pathway.risks;
    
    // Populate required forms
    requiredFormsContainer.innerHTML = '';
    pathway.requiredForms.forEach(form => {
        const formCard = createFormCard(form);
        requiredFormsContainer.appendChild(formCard);
    });
    
    pathwayDetails.style.display = 'block';
    
    // Scroll to details
    pathwayDetails.scrollIntoView({ behavior: 'smooth' });
}

function createFormCard(form) {
    const card = document.createElement('div');
    card.className = 'document-card';
    
    const priorityClass = `priority-${form.priority}`;
    const statusClass = `status-${form.status}`;
    
    card.innerHTML = `
        <div class="document-status ${statusClass}">${form.status.charAt(0).toUpperCase() + form.status.slice(1)}</div>
        <div class="document-title" data-doc-id="${form.id}">${form.name}</div>
        <div class="document-priority ${priorityClass}">Priority: ${form.priority.charAt(0).toUpperCase() + form.priority.slice(1)}</div>
        <div class="document-actions">
            <button class="btn btn-secondary" onclick="viewDocument('${form.id}')">View</button>
            <button class="btn btn-primary" onclick="fillDocument('${form.id}')">Fill</button>
            <button class="btn btn-success" onclick="downloadDocument('${form.id}')">Download</button>
        </div>
    `;
    
    return card;
}

// Document Functions
function populateDocuments() {
    // Use real USCIS forms data if available, otherwise fallback to our data
    let documents = [];
    
    if (realUSCISForms) {
        // Map real USCIS forms to our document structure
        const keyForms = ['i-130', 'i-140', 'i-485', 'n-400', 'i-90', 'i-751', 'i-601', 'i-821', 'i-765', 'g-1145', 'i-821d', 'i-131', 'i-589'];
        
        documents = realUSCISForms
            .filter(form => {
                const formId = form.name.toLowerCase().match(/i-\d+|n-\d+|g-\d+/)?.[0];
                return formId && keyForms.includes(formId);
            })
            .map(form => {
                const formId = form.name.toLowerCase().match(/i-\d+|n-\d+|g-\d+/)?.[0] || 'unknown';
                const pdfUrls = form.pdfs || [];
                const mainPdf = pdfUrls.find(url => url.includes(formId + '.pdf')) || pdfUrls[0];
                
                return {
                    id: formId,
                    name: form.name,
                    description: form.description || 'Official USCIS form',
                    status: 'pending',
                    fields: getFormFields(formId),
                    category: getFormCategory(formId),
                    priority: getFormPriority(formId),
                    stage: getFormStage(formId),
                    pdfUrl: mainPdf,
                    allPdfs: pdfUrls,
                    detailUrl: form.detail_url
                };
            });
    } else {
        // Fallback to our original data
        documents = [
            {
                id: 'i-130',
                name: 'Form I-130 - Petition for Alien Relative',
                description: 'Petition filed by U.S. citizen or LPR to establish family relationship for immigrant status',
                status: 'pending',
                fields: ['petitionerInfo', 'beneficiaryInfo', 'relationshipEvidence', 'supportingDocuments'],
                category: 'family',
                priority: 'high',
                stage: 'family-based'
            },
            {
                id: 'i-485',
                name: 'Form I-485 - Adjustment of Status',
                description: 'Application to register permanent residence or adjust status to lawful permanent resident',
                status: 'pending',
                fields: ['personalInfo', 'immigrationHistory', 'familyInfo', 'criminalHistory', 'medicalExam'],
                category: 'permanent_resident',
                priority: 'high',
                stage: 'family-based'
            },
            {
                id: 'n-400',
                name: 'Form N-400 - Application for Naturalization',
                description: 'Application for lawful permanent residents to become U.S. citizens',
                status: 'pending',
                fields: ['personalInfo', 'residenceHistory', 'employmentHistory', 'criminalHistory', 'englishTest', 'civicsTest'],
                category: 'citizenship',
                priority: 'high',
                stage: 'naturalization'
            },
            {
                id: 'i-821d',
                name: 'Form I-821D - DACA Application',
                description: 'Application for Deferred Action for Childhood Arrivals',
                status: 'pending',
                fields: ['personalInfo', 'arrivalInfo', 'educationInfo', 'criminalHistory', 'economicNecessity'],
                category: 'daca',
                priority: 'high',
                stage: 'relief'
            }
        ];
    }
    
    const container = document.getElementById('documentsPreview');
    if (container) {
        container.innerHTML = '';
        documents.slice(0, 4).forEach(doc => {
            const docCard = createDocumentCard(doc);
            container.appendChild(docCard);
        });
    }
}

function createDocumentCard(doc, isPreview = false) {
    const card = document.createElement('div');
    card.className = 'document-card';
    
    const statusClass = `status-${doc.status}`;
    const statusText = doc.status.charAt(0).toUpperCase() + doc.status.slice(1).replace('-', ' ');
    
    card.innerHTML = `
        <div class="document-status ${statusClass}">${statusText}</div>
        <div class="document-title" data-doc-id="${doc.id}">${doc.name}</div>
        <div class="document-description" data-doc-id="${doc.id}">${doc.description}</div>
        <div class="document-actions">
            <button class="btn btn-secondary" onclick="viewDocument('${doc.id}')">View</button>
            <button class="btn btn-primary" onclick="fillDocument('${doc.id}')">Fill</button>
            <button class="btn btn-success" onclick="downloadDocument('${doc.id}')">Download</button>
        </div>
    `;
    
    return card;
}

// Helper functions for form categorization
function getFormFields(formId) {
    const fieldMap = {
        'i-130': ['petitionerInfo', 'beneficiaryInfo', 'relationshipEvidence', 'supportingDocuments'],
        'i-140': ['employerInfo', 'workerInfo', 'jobOffer', 'qualifications', 'laborCertification'],
        'i-485': ['personalInfo', 'immigrationHistory', 'familyInfo', 'criminalHistory', 'medicalExam'],
        'n-400': ['personalInfo', 'residenceHistory', 'employmentHistory', 'criminalHistory', 'englishTest', 'civicsTest'],
        'i-90': ['personalInfo', 'cardInfo', 'reasonForReplacement', 'supportingDocuments'],
        'i-751': ['personalInfo', 'marriageInfo', 'relationshipEvidence', 'supportingDocuments'],
        'i-601': ['personalInfo', 'inadmissibilityGrounds', 'hardshipEvidence', 'supportingDocuments'],
        'i-821': ['personalInfo', 'countryOfOrigin', 'entryDate', 'supportingDocuments'],
        'i-765': ['personalInfo', 'immigrationStatus', 'employmentHistory', 'supportingDocuments'],
        'g-1145': ['personalInfo', 'contactInfo', 'applicationDetails'],
        'i-821d': ['personalInfo', 'arrivalInfo', 'educationInfo', 'criminalHistory', 'economicNecessity'],
        'i-131': ['personalInfo', 'travelPurpose', 'travelDates', 'supportingEvidence'],
        'i-589': ['personalInfo', 'asylumReason', 'persecutionDetails', 'supportingEvidence']
    };
    return fieldMap[formId] || ['personalInfo', 'supportingDocuments'];
}

function getFormCategory(formId) {
    const categoryMap = {
        'i-130': 'family',
        'i-140': 'employment',
        'i-485': 'permanent_resident',
        'n-400': 'citizenship',
        'i-90': 'permanent_resident',
        'i-751': 'permanent_resident',
        'i-601': 'waiver',
        'i-821': 'tps',
        'i-765': 'employment',
        'g-1145': 'notification',
        'i-821d': 'daca',
        'i-131': 'travel',
        'i-589': 'asylum'
    };
    return categoryMap[formId] || 'general';
}

function getFormPriority(formId) {
    const priorityMap = {
        'i-130': 'high',
        'i-140': 'high',
        'i-485': 'high',
        'n-400': 'high',
        'i-90': 'medium',
        'i-751': 'high',
        'i-601': 'high',
        'i-821': 'high',
        'i-765': 'high',
        'g-1145': 'low',
        'i-821d': 'high',
        'i-131': 'medium',
        'i-589': 'high'
    };
    return priorityMap[formId] || 'medium';
}

function getFormStage(formId) {
    const stageMap = {
        'i-130': 'family-based',
        'i-140': 'employment-based',
        'i-485': 'family-based',
        'n-400': 'naturalization',
        'i-90': 'maintenance',
        'i-751': 'maintenance',
        'i-601': 'relief',
        'i-821': 'relief',
        'i-765': 'supportive',
        'g-1145': 'supportive',
        'i-821d': 'relief',
        'i-131': 'supportive',
        'i-589': 'relief'
    };
    return stageMap[formId] || 'general';
}

function viewDocument(docId) {
    const documents = {
        'i-821d': {
            name: 'Form I-821D - DACA Application',
            description: 'Application for Deferred Action for Childhood Arrivals',
            fields: [
                { id: 'personalInfo', label: 'Personal Information', type: 'section' },
                { id: 'firstName', label: 'First Name', type: 'text', required: true },
                { id: 'lastName', label: 'Last Name', type: 'text', required: true },
                { id: 'middleName', label: 'Middle Name', type: 'text', required: false },
                { id: 'dateOfBirth', label: 'Date of Birth', type: 'date', required: true },
                { id: 'countryOfBirth', label: 'Country of Birth', type: 'select', required: true, options: ['Mexico', 'China', 'India', 'Philippines', 'El Salvador', 'Guatemala', 'Honduras', 'Cuba', 'Dominican Republic', 'Colombia', 'Venezuela', 'Brazil', 'Argentina', 'Peru', 'Ecuador', 'Bolivia', 'Chile', 'Uruguay', 'Paraguay', 'Other'] },
                { id: 'currentAddress', label: 'Current Address', type: 'textarea', required: true },
                { id: 'phoneNumber', label: 'Phone Number', type: 'tel', required: true },
                { id: 'emailAddress', label: 'Email Address', type: 'email', required: true },
                { id: 'socialSecurityNumber', label: 'Social Security Number', type: 'text', required: false },
                { id: 'arrivalInfo', label: 'Arrival Information', type: 'section' },
                { id: 'entryDate', label: 'Date of Entry to US', type: 'date', required: true },
                { id: 'methodOfEntry', label: 'Method of Entry', type: 'select', required: true, options: ['Visa', 'Border Crossing', 'Airport', 'Other'] },
                { id: 'educationInfo', label: 'Education Information', type: 'section' },
                { id: 'educationLevel', label: 'Education Level', type: 'select', required: true, options: ['Elementary', 'Middle School', 'High School', 'Some College', 'Associate Degree', 'Bachelor Degree', 'Master Degree', 'Doctorate'] },
                { id: 'schoolName', label: 'Current/Last School Name', type: 'text', required: false },
                { id: 'graduationDate', label: 'Graduation Date', type: 'date', required: false },
                { id: 'criminalHistory', label: 'Criminal History', type: 'section' },
                { id: 'criminalRecord', label: 'Criminal Record', type: 'select', required: true, options: ['None', 'Minor Offenses', 'Major Offenses'] },
                { id: 'criminalDetails', label: 'Criminal Details (if applicable)', type: 'textarea', required: false },
                { id: 'economicNecessity', label: 'Economic Necessity', type: 'section' },
                { id: 'employmentStatus', label: 'Employment Status', type: 'select', required: true, options: ['Employed', 'Unemployed', 'Student', 'Self-Employed', 'Retired', 'Other'] },
                { id: 'annualIncome', label: 'Annual Income', type: 'number', required: false },
                { id: 'householdSize', label: 'Household Size', type: 'number', required: false },
                { id: 'economicHardship', label: 'Economic Hardship Explanation', type: 'textarea', required: false }
            ]
        }
    };
    
    const doc = documents[docId];
    if (!doc) return;
    
    openDocumentModal(doc);
}

function openDocumentModal(doc) {
    const modal = document.getElementById('documentModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = doc.name;
    
    let fieldsHtml = '';
    doc.fields.forEach(field => {
        if (field.type === 'section') {
            fieldsHtml += `<h3 class="form-section">${field.label}</h3>`;
        } else {
            fieldsHtml += `
                <div class="form-field">
                    <label for="${field.id}">${field.label}${field.required ? ' *' : ''}</label>
                    ${createFieldInput(field)}
                </div>
            `;
        }
    });
    
    modalBody.innerHTML = fieldsHtml;
    modal.classList.add('active');
}

function createFieldInput(field) {
    switch (field.type) {
        case 'text':
        case 'email':
        case 'tel':
        case 'date':
        case 'number':
            return `<input type="${field.type}" id="${field.id}" name="${field.id}" ${field.required ? 'required' : ''}>`;
        case 'textarea':
            return `<textarea id="${field.id}" name="${field.id}" rows="3" ${field.required ? 'required' : ''}></textarea>`;
        case 'select':
            let options = '<option value="">Select...</option>';
            if (field.options) {
                field.options.forEach(option => {
                    options += `<option value="${option}">${option}</option>`;
                });
            }
            return `<select id="${field.id}" name="${field.id}" ${field.required ? 'required' : ''}>${options}</select>`;
        case 'checkbox':
            return `<input type="checkbox" id="${field.id}" name="${field.id}">`;
        default:
            return `<input type="text" id="${field.id}" name="${field.id}" ${field.required ? 'required' : ''}>`;
    }
}

function closeDocumentModal() {
    const modal = document.getElementById('documentModal');
    modal.classList.remove('active');
}

function fillDocument(docId) {
    // This would open a form filling interface
    showNotification('Form filling feature coming soon!', 'info');
}

function downloadDocument(docId) {
    // First check if we have real USCIS PDF data
    if (realUSCISForms) {
        const realForm = realUSCISForms.find(form => {
            const formId = form.name.toLowerCase().match(/i-\d+|n-\d+|g-\d+/)?.[0];
            return formId === docId;
        });
        
        if (realForm && realForm.pdfs && realForm.pdfs.length > 0) {
            // Check for multilingual forms
            const languageForms = getMultilingualForms(realForm.pdfs, currentLanguage);
            
            if (languageForms.length > 1) {
                // Show language selection dialog
                showLanguageSelectionDialog(docId, languageForms, realForm);
                return;
            } else {
                // Open the appropriate PDF (English or language-specific)
                const targetPdf = languageForms[0] || realForm.pdfs.find(url => url.includes(docId + '.pdf')) || realForm.pdfs[0];
                window.open(targetPdf, '_blank');
                return;
            }
        }
    }
    
    // Fallback to our form data download
    const savedData = localStorage.getItem(`form_${docId}`);
    if (!savedData) {
        showNotification('Please fill out the form first before downloading.', 'warning');
        return;
    }
    
    showNotification(`Downloading ${docId}...`, 'success');
}

// Multilingual form support functions
function getMultilingualForms(pdfUrls, currentLang) {
    const languageMap = {
        'es': ['ES', 'Spanish'],
        'zh': ['CH', 'Chinese'],
        'ar': ['AR', 'Arabic'],
        'hi': ['HC', 'Hindi'],
        'pt': ['PT', 'Portuguese'],
        'ru': ['RU', 'Russian'],
        'fr': ['FR', 'French'],
        'so': ['SO', 'Somali'],
        'vi': ['VI', 'Vietnamese'],
        'tr': ['TUR', 'Turkish'],
        'ps': ['PSH', 'Pashto'],
        'dar': ['DAR', 'Dari']
    };
    
    const availableForms = [];
    
    pdfUrls.forEach(url => {
        const filename = url.split('/').pop().toLowerCase();
        
        // Check if it's a language-specific form
        Object.entries(languageMap).forEach(([lang, codes]) => {
            codes.forEach(code => {
                if (filename.includes(code.toLowerCase())) {
                    availableForms.push({
                        url: url,
                        language: lang,
                        languageName: codes[1],
                        isCurrentLang: lang === currentLang
                    });
                }
            });
        });
        
        // Check if it's the English/default form
        if (filename.includes('.pdf') && !filename.includes('_') && !filename.includes('watermark')) {
            availableForms.push({
                url: url,
                language: 'en',
                languageName: 'English',
                isCurrentLang: currentLang === 'en'
            });
        }
    });
    
    // Remove duplicates and prioritize current language
    const uniqueForms = [];
    const seenUrls = new Set();
    
    // First add current language forms
    availableForms.forEach(form => {
        if (form.isCurrentLang && !seenUrls.has(form.url)) {
            uniqueForms.push(form);
            seenUrls.add(form.url);
        }
    });
    
    // Then add other forms
    availableForms.forEach(form => {
        if (!form.isCurrentLang && !seenUrls.has(form.url)) {
            uniqueForms.push(form);
            seenUrls.add(form.url);
        }
    });
    
    return uniqueForms;
}

function showLanguageSelectionDialog(docId, languageForms, realForm) {
    const languageOptions = document.getElementById('languageOptions');
    const languageDialog = document.getElementById('languageDialog');
    
    languageOptions.innerHTML = '';
    
    languageForms.forEach(form => {
        const isRecommended = form.isCurrentLang ? ' (Recommended)' : '';
        const option = document.createElement('button');
        option.className = `language-option ${form.isCurrentLang ? 'current' : ''}`;
        option.textContent = form.languageName + isRecommended;
        option.onclick = () => downloadFormInLanguage(form.url, form.languageName);
        languageOptions.appendChild(option);
    });
    
    languageDialog.classList.add('active');
}

function downloadFormInLanguage(url, languageName) {
    window.open(url, '_blank');
    closeLanguageDialog();
    showNotification(`Download started - ${languageName} version`, 'success');
}

function closeLanguageDialog() {
    const languageDialog = document.getElementById('languageDialog');
    languageDialog.classList.remove('active');
}

// Chat Functions
function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addMessage(message, 'user');
    
    // Clear input
    input.value = '';
    
    // Show typing indicator
    showTypingIndicator();
    
    // Generate AI response
    setTimeout(async () => {
        const aiResponse = await generateAIResponse(message);
        hideTypingIndicator();
        addMessage(aiResponse, 'ai');
    }, 1000);
}

function addMessage(content, sender) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const avatar = sender === 'ai' ? '🤖' : '👤';
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            ${avatar}
        </div>
        <div class="message-content">
            <p>${content}</p>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai typing-indicator';
    typingDiv.id = 'typingIndicator';
    
    typingDiv.innerHTML = `
        <div class="message-avatar">
            🤖
        </div>
        <div class="message-content">
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

async function generateAIResponse(userMessage) {
    const message = userMessage.toLowerCase();
    const t = translations[currentLanguage] || translations.en;
    
    // Check if we have a document uploaded and backend is available
    if (currentDocumentId && message.includes('?')) {
        try {
            const questionResult = await askQuestionAboutDocument(userMessage);
            return `🤖 **AI Analysis:**\n\n${questionResult.answer}\n\n*Confidence: ${Math.round(questionResult.confidence * 100)}%*`;
        } catch (error) {
            console.warn('Backend question answering failed:', error);
            // Fall through to regular response
        }
    }
    
    // Check for LEQ help requests
    if (message.includes('help with') || message.includes('explain question') || message.includes('simplify question')) {
        return handleLEQHelp(userMessage, currentLanguage);
    }
    
    // Check for specific form mentions
    if (message.includes('i-821d') || message.includes('daca')) {
        return t.aiResponseDACA || "I can help you fill out Form I-821D (DACA). Based on your profile, I will guide you through each section. Let's start with your personal information.";
    }
    
    if (message.includes('i-765') || message.includes('work permit')) {
        return t.aiResponseWorkPermit || "For Form I-765 (Work Permit), you will need to provide your employment authorization details. I can help you complete this step by step.";
    }
    
    if (message.includes('i-131') || message.includes('travel')) {
        return t.aiResponseTravel || "Form I-131 is for advance parole/travel document. I can help you understand the requirements and fill out this form.";
    }
    
    if (message.includes('help') || message.includes('assist')) {
        return t.aiResponseHelp || "I can assist you with any immigration form. Just tell me which form you're working on and I'll help you fill it out using your profile information.";
    }
    
    if (message.includes('status') || message.includes('case')) {
        return t.aiResponseStatus || "Based on your profile, I can help you check your application status and guide you through the next steps in your immigration process.";
    }
    
    if (message.includes('document') || message.includes('form')) {
        return t.aiResponseDocuments || "I can help you understand the requirements for each document. Which document would you like me to explain or help you fill out?";
    }
    
    // Default intelligent response
    const responses = [
        t.aiResponseDefault1 || "I can help you fill out Form I-821D. Based on your profile, I will guide you through each section. Let's start with your personal information.",
        t.aiResponseDefault2 || "For Form I-765, you will need to provide your employment information. I can help you complete this section step by step.",
        t.aiResponseDefault3 || "I notice you are working on your DACA renewal. I can help you fill out all the required forms using your profile information.",
        t.aiResponseDefault4 || "Let me help you with the Economic Necessity Worksheet. I will guide you through the financial information needed.",
        t.aiResponseDefault5 || "I can assist you with any immigration form. Just tell me which form you're working on and I will help you fill it out.",
        t.aiResponseDefault6 || "Based on your information, I can help you complete all your immigration forms. Would you like to start with Form I-821D?",
        t.aiResponseDefault7 || "I can explain any immigration process in detail. What specific question do you have about your application?",
        t.aiResponseDefault8 || "I can help you understand the requirements for each document. Which document would you like me to explain?"
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
}

// LEQ Help Function
function handleLEQHelp(userMessage, language = 'en') {
    const message = userMessage.toLowerCase();
    
    // Try to identify which form the user is asking about
    let formId = null;
    if (message.includes('i-821d') || message.includes('daca')) {
        formId = 'i-821d';
    } else if (message.includes('i-589') || message.includes('asylum')) {
        formId = 'i-589';
    } else if (message.includes('i-130') || message.includes('family')) {
        formId = 'i-130';
    } else if (message.includes('i-485') || message.includes('adjustment')) {
        formId = 'i-485';
    } else if (message.includes('n-400') || message.includes('naturalization')) {
        formId = 'n-400';
    }
    
    if (formId && leqDataset[formId]) {
        const formLEQs = leqDataset[formId];
        let response = `📋 **${formLEQs.name} - Simplified Questions**\n\n`;
        
        formLEQs.leqs.forEach((leq, index) => {
            response += `**Question ${index + 1}:**\n`;
            response += `🔹 **Original:** ${leq.original}\n`;
            response += `✨ **Simplified:** ${leq.translated[language] || leq.translated.en}\n\n`;
        });
        
        response += `💡 **Tip:** I can help you answer these questions step by step. Just ask me about any specific question!`;
        
        return response;
    }
    
    // If no specific form identified, show available forms
    let response = `📋 **Available Forms with Simplified Questions**\n\n`;
    Object.keys(leqDataset).forEach(formId => {
        const form = leqDataset[formId];
        response += `• **${form.name}** - Ask me about "${formId}" questions\n`;
    });
    
    response += `\n💡 **How to use:** Say "help with [form name]" or "explain [form name] questions" to get simplified versions of all questions for that form.`;
    
    return response;
}

// LEQ Dataset
const leqDataset = {
    'i-821d': {
        name: 'Form I-821D - DACA Application',
        leqs: [
            {
                original: "Provide a detailed explanation of your current immigration status and any previous immigration applications or petitions filed on your behalf.",
                simplified: "Tell us about your current immigration status and any previous immigration applications you or someone else filed for you.",
                translated: {
                    en: "Tell us about your current immigration status and any previous immigration applications you or someone else filed for you.",
                    es: "Cuéntanos sobre tu estado migratorio actual y cualquier solicitud migratoria anterior que tú o alguien más haya presentado por ti.",
                    zh: "告诉我们您当前的移民身份以及您或他人为您提交的任何以前的移民申请。",
                    ar: "أخبرنا عن وضعك الهجري الحالي وأي طلبات هجرة سابقة قدمتها أنت أو شخص آخر نيابة عنك.",
                    hi: "हमें अपनी वर्तमान आप्रवासन स्थिति और आपके या किसी और द्वारा आपके लिए दायर किए गए किसी भी पिछले आप्रवासन आवेदन के बारे में बताएं।",
                    pt: "Conte-nos sobre seu status de imigração atual e qualquer aplicação de imigração anterior que você ou outra pessoa tenha arquivado em seu nome.",
                    ru: "Расскажите нам о вашем текущем иммиграционном статусе и любых предыдущих иммиграционных заявлениях, поданных вами или кем-то другим от вашего имени.",
                    fr: "Parlez-nous de votre statut d'immigration actuel et de toute demande d'immigration précédente que vous ou quelqu'un d'autre avez déposée en votre nom."
                }
            },
            {
                original: "Describe the circumstances surrounding your entry into the United States, including the date, location, and method of entry.",
                simplified: "Tell us how you came to the United States - when, where, and how you entered.",
                translated: {
                    en: "Tell us how you came to the United States - when, where, and how you entered.",
                    es: "Cuéntanos cómo llegaste a Estados Unidos - cuándo, dónde y cómo entraste.",
                    zh: "告诉我们您是如何来到美国的 - 何时、何地以及如何进入的。",
                    ar: "أخبرنا كيف أتيت إلى الولايات المتحدة - متى وأين وكيف دخلت.",
                    hi: "हमें बताएं कि आप संयुक्त राज्य अमेरिका कैसे आए - कब, कहाँ और कैसे प्रवेश किया।",
                    pt: "Conte-nos como você veio para os Estados Unidos - quando, onde e como você entrou.",
                    ru: "Расскажите нам, как вы приехали в Соединенные Штаты - когда, где и как вы въехали.",
                    fr: "Parlez-nous de comment vous êtes venu aux États-Unis - quand, où et comment vous êtes entré."
                }
            },
            {
                original: "Explain your educational background, including schools attended, degrees obtained, and any educational achievements.",
                simplified: "Tell us about your education - what schools you went to, what degrees you have, and any educational accomplishments.",
                translated: {
                    en: "Tell us about your education - what schools you went to, what degrees you have, and any educational accomplishments.",
                    es: "Cuéntanos sobre tu educación - a qué escuelas fuiste, qué títulos tienes y cualquier logro educativo.",
                    zh: "告诉我们您的教育背景 - 您上过什么学校，有什么学位，以及任何教育成就。",
                    ar: "أخبرنا عن تعليمك - أي المدارس ذهبت إليها، وما هي الدرجات التي حصلت عليها، وأي إنجازات تعليمية.",
                    hi: "हमें अपनी शिक्षा के बारे में बताएं - आप किन स्कूलों में गए, आपके पास कौन सी डिग्री है, और कोई भी शैक्षणिक उपलब्धि।",
                    pt: "Conte-nos sobre sua educação - quais escolas você frequentou, que diplomas você tem e quaisquer conquistas educacionais.",
                    ru: "Расскажите нам о вашем образовании - в какие школы вы ходили, какие степени у вас есть, и любые образовательные достижения.",
                    fr: "Parlez-nous de votre éducation - quelles écoles vous avez fréquentées, quels diplômes vous avez et toute réalisation éducative."
                }
            },
            {
                original: "Provide a comprehensive explanation of your economic necessity for employment authorization, including your current financial situation and how employment would benefit you and your family.",
                simplified: "Tell us why you need to work - explain your current money situation and how having a job would help you and your family.",
                translated: {
                    en: "Tell us why you need to work - explain your current money situation and how having a job would help you and your family.",
                    es: "Cuéntanos por qué necesitas trabajar - explica tu situación económica actual y cómo tener un trabajo te ayudaría a ti y a tu familia.",
                    zh: "告诉我们为什么您需要工作 - 解释您当前的经济状况以及有工作如何帮助您和您的家人。",
                    ar: "أخبرنا لماذا تحتاج إلى العمل - اشرح وضعك المالي الحالي وكيف ستساعدك الوظيفة أنت وعائلتك.",
                    hi: "हमें बताएं कि आपको काम क्यों चाहिए - अपनी वर्तमान आर्थिक स्थिति और नौकरी होने से आपको और आपके परिवार को कैसे मदद मिलेगी।",
                    pt: "Conte-nos por que você precisa trabalhar - explique sua situação financeira atual e como ter um emprego ajudaria você e sua família.",
                    ru: "Расскажите нам, почему вам нужно работать - объясните вашу текущую финансовую ситуацию и как работа поможет вам и вашей семье.",
                    fr: "Parlez-nous de pourquoi vous avez besoin de travailler - expliquez votre situation financière actuelle et comment avoir un emploi vous aiderait vous et votre famille."
                }
            }
        ]
    },
    'i-589': {
        name: 'Form I-589 - Asylum Application',
        leqs: [
            {
                original: "Provide a detailed account of the persecution you have suffered or fear you will suffer in your home country, including specific incidents, dates, and locations.",
                simplified: "Tell us about the harm you experienced or are afraid of experiencing in your home country. Include specific events, when they happened, and where.",
                translated: {
                    en: "Tell us about the harm you experienced or are afraid of experiencing in your home country. Include specific events, when they happened, and where.",
                    es: "Cuéntanos sobre el daño que experimentaste o temes experimentar en tu país de origen. Incluye eventos específicos, cuándo sucedieron y dónde.",
                    zh: "告诉我们您在本国经历或害怕经历的伤害。包括具体事件、发生时间和地点。",
                    ar: "أخبرنا عن الأذى الذي تعرضت له أو تخشى التعرض له في بلدك الأصلي. أدرج أحداث محددة ومتى حدثت وأين.",
                    hi: "हमें अपने मूल देश में आपके द्वारा अनुभव किए गए या अनुभव करने के डर के बारे में बताएं। विशिष्ट घटनाओं, जब वे हुईं और कहाँ शामिल करें।",
                    pt: "Conte-nos sobre o dano que você experimentou ou teme experimentar em seu país de origem. Inclua eventos específicos, quando aconteceram e onde.",
                    ru: "Расскажите нам о вреде, который вы испытали или боитесь испытать в вашей родной стране. Включите конкретные события, когда они произошли и где.",
                    fr: "Parlez-nous du mal que vous avez subi ou craignez de subir dans votre pays d'origine. Incluez des événements spécifiques, quand ils se sont produits et où."
                }
            },
            {
                original: "Explain the basis for your fear of persecution, including the specific grounds (race, religion, nationality, political opinion, or membership in a particular social group) and how these grounds relate to your situation.",
                simplified: "Tell us why you are afraid of being harmed. Explain which reason applies to you: your race, religion, nationality, political beliefs, or being part of a specific group.",
                translated: {
                    en: "Tell us why you are afraid of being harmed. Explain which reason applies to you: your race, religion, nationality, political beliefs, or being part of a specific group.",
                    es: "Cuéntanos por qué tienes miedo de ser dañado. Explica qué razón se aplica a ti: tu raza, religión, nacionalidad, creencias políticas o ser parte de un grupo específico.",
                    zh: "告诉我们为什么您害怕受到伤害。解释哪个原因适用于您：您的种族、宗教、国籍、政治信仰或属于特定群体。",
                    ar: "أخبرنا لماذا تخشى التعرض للأذى. اشرح أي سبب ينطبق عليك: عرقك أو دينك أو جنسيتك أو معتقداتك السياسية أو كونك جزءًا من مجموعة محددة.",
                    hi: "हमें बताएं कि आपको नुकसान पहुंचाने का डर क्यों है। बताएं कि कौन सा कारण आप पर लागू होता है: आपकी जाति, धर्म, राष्ट्रीयता, राजनीतिक मान्यताएं या किसी विशिष्ट समूह का हिस्सा होना।",
                    pt: "Conte-nos por que você tem medo de ser prejudicado. Explique qual razão se aplica a você: sua raça, religião, nacionalidade, crenças políticas ou ser parte de um grupo específico.",
                    ru: "Расскажите нам, почему вы боитесь причинения вреда. Объясните, какая причина применима к вам: ваша раса, религия, национальность, политические убеждения или принадлежность к определенной группе.",
                    fr: "Parlez-nous de pourquoi vous avez peur d'être blessé. Expliquez quelle raison s'applique à vous: votre race, religion, nationalité, croyances politiques ou faire partie d'un groupe spécifique."
                }
            },
            {
                original: "Describe any efforts you have made to relocate within your home country to avoid persecution, and explain why such relocation would not be reasonable.",
                simplified: "Tell us if you tried to move to a different part of your home country to avoid harm, and explain why moving there wouldn't be safe or reasonable.",
                translated: {
                    en: "Tell us if you tried to move to a different part of your home country to avoid harm, and explain why moving there wouldn't be safe or reasonable.",
                    es: "Cuéntanos si intentaste mudarte a una parte diferente de tu país de origen para evitar daño, y explica por qué mudarte allí no sería seguro o razonable.",
                    zh: "告诉我们您是否尝试搬到本国其他地区以避免伤害，并解释为什么搬到那里不安全或不合理。",
                    ar: "أخبرنا إذا حاولت الانتقال إلى جزء مختلف من بلدك الأصلي لتجنب الأذى، واشرح لماذا لن يكون الانتقال هناك آمناً أو معقولاً.",
                    hi: "हमें बताएं कि क्या आपने नुकसान से बचने के लिए अपने मूल देश के किसी अलग हिस्से में जाने की कोशिश की, और बताएं कि वहां जाना सुरक्षित या उचित क्यों नहीं होगा।",
                    pt: "Conte-nos se você tentou se mudar para uma parte diferente do seu país de origem para evitar danos, e explique por que se mudar para lá não seria seguro ou razoável.",
                    ru: "Расскажите нам, пытались ли вы переехать в другую часть вашей родной страны, чтобы избежать вреда, и объясните, почему переезд туда не был бы безопасным или разумным.",
                    fr: "Parlez-nous si vous avez essayé de déménager dans une partie différente de votre pays d'origine pour éviter le mal, et expliquez pourquoi déménager là-bas ne serait pas sûr ou raisonnable."
                }
            }
        ]
    }
};

// Document Upload Handler with Backend Integration
async function handleDocumentUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check if backend is available
    const backendAvailable = await checkBackendConnection();
    
    if (backendAvailable && file.type === 'application/pdf') {
        try {
            // Show loading message
            addMessage(`📄 Uploading ${file.name} to AI analysis system...`, 'ai');
            
            // Upload to backend
            const uploadResult = await uploadDocumentToBackend(file);
            
            // Analyze the document
            addMessage(`🔍 Analyzing document with AI...`, 'ai');
            const analysisResult = await analyzeDocumentWithAI('comprehensive');
            
            // Show results
            let response = `✅ **Document Analysis Complete!**\n\n`;
            response += `📋 **Document Type:** ${uploadResult.document_type}\n`;
            response += `📄 **Pages:** ${uploadResult.page_count}\n`;
            response += `🎯 **Confidence:** ${Math.round(uploadResult.confidence_score * 100)}%\n\n`;
            
            if (analysisResult.analysis) {
                response += `📝 **Summary:**\n${analysisResult.analysis.summary}\n\n`;
                
                if (analysisResult.analysis.key_information) {
                    response += `🔑 **Key Information:**\n`;
                    Object.entries(analysisResult.analysis.key_information).forEach(([key, value]) => {
                        response += `• **${key}:** ${value}\n`;
                    });
                    response += `\n`;
                }
                
                if (analysisResult.analysis.recommendations) {
                    response += `💡 **Recommendations:**\n${analysisResult.analysis.recommendations}\n\n`;
                }
            }
            
            response += `🤖 **I can now answer specific questions about this document. What would you like to know?**`;
            
            addMessage(response, 'ai');
            
        } catch (error) {
            console.error('Backend processing failed:', error);
            addMessage(`❌ **Error processing document:** ${error.message}\n\nFalling back to basic text analysis...`, 'ai');
            
            // Fallback to basic text processing
            const reader = new FileReader();
            reader.onload = function(e) {
                const content = e.target.result;
                addMessage(`I've received your document: ${file.name}. I can help you analyze it and answer questions about its content. What would you like to know?`, 'ai');
            };
            reader.readAsText(file);
        }
    } else {
        // Fallback for non-PDF files or when backend is unavailable
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            addMessage(`I've received your document: ${file.name}. I can help you analyze it and answer questions about its content. What would you like to know?`, 'ai');
        };
        reader.readAsText(file);
    }
    
    // Reset file input
    event.target.value = '';
}

function uploadDocument() {
    document.getElementById('documentUpload').click();
}

// Voice Recording Functions
function initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = currentLanguage;
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            document.getElementById('messageInput').value = transcript;
        };
        
        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            showNotification('Speech recognition error. Please try again.', 'error');
        };
    }
}

function toggleVoiceRecording() {
    if (!recognition) {
        showNotification('Speech recognition not supported in this browser.', 'error');
        return;
    }
    
    const voiceBtn = document.getElementById('voiceBtn');
    
    if (isRecording) {
        recognition.stop();
        voiceBtn.classList.remove('recording');
        isRecording = false;
    } else {
        recognition.start();
        voiceBtn.classList.add('recording');
        isRecording = true;
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// Help Resources
function populateHelpResources() {
    const resources = {
        emergency: [
            { name: 'National Immigration Hotline', phone: '1-800-375-5283', description: '24/7 emergency assistance' },
            { name: 'ICE Detention Hotline', phone: '1-888-351-4024', description: 'Report detention issues' },
            { name: 'Legal Aid Hotline', phone: '1-800-399-4529', description: 'Free legal assistance' }
        ],
        legal: [
            { name: 'Legal Aid Society', phone: '1-800-399-4529', description: 'Free consultations and representation' },
            { name: 'Immigrant Legal Resource Center', phone: '1-415-255-9499', description: 'Legal resources and training' },
            { name: 'American Immigration Lawyers Association', phone: '1-202-507-7600', description: 'Find qualified immigration lawyers' }
        ],
        community: [
            { name: 'Local Community Centers', description: 'Find centers in your area' },
            { name: 'Immigrant Rights Organizations', description: 'Advocacy and support groups' },
            { name: 'Religious Organizations', description: 'Faith-based assistance programs' }
        ],
        healthcare: [
            { name: 'Community Health Centers', description: 'Low-cost healthcare services' },
            { name: 'Emergency Medical Services', phone: '911', description: 'Emergency medical care' },
            { name: 'Mental Health Resources', description: 'Counseling and support services' }
        ],
        employment: [
            { name: 'Workforce Development Centers', description: 'Job training and placement' },
            { name: 'Employment Rights Organizations', description: 'Workplace rights and protections' },
            { name: 'Small Business Resources', description: 'Entrepreneurship support' }
        ],
        education: [
            { name: 'Adult Education Centers', description: 'English classes and GED programs' },
            { name: 'Community Colleges', description: 'Affordable higher education' },
            { name: 'Scholarship Programs', description: 'Financial aid for immigrants' }
        ]
    };
    
    Object.entries(resources).forEach(([category, items]) => {
        const container = document.getElementById(`${category}ResourcesContainer`);
        if (container) {
            container.innerHTML = '';
            items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'help-item';
                itemDiv.innerHTML = `
                    <h4>${item.name}</h4>
                    <p>${item.description}</p>
                    ${item.phone ? `<a href="tel:${item.phone}">${item.phone}</a>` : ''}
                `;
                container.appendChild(itemDiv);
            });
        }
    });
}

// Profile Functions
function saveProfile() {
    const form = document.getElementById('profileForm');
    const formData = new FormData(form);
    
    userProfile = {};
    for (let [key, value] of formData.entries()) {
        userProfile[key] = value;
    }
    
    localStorage.setItem('userProfile', JSON.stringify(userProfile));
    profileComplete = true;
    
    showNotification('Profile saved successfully!', 'success');
    updateProgress();
}

// Progress Functions
function updateProgress() {
    const completed = profileComplete ? 1 : 0;
    const remaining = 3 - completed;
    
    document.querySelector('.stat-number').textContent = completed;
    document.querySelectorAll('.stat-number')[1].textContent = remaining;
    
    // Update progress ring
    const progressRing = document.querySelector('.progress-ring-circle-fill');
    const circumference = 2 * Math.PI * 25;
    const progress = (completed / 3) * 100;
    const offset = circumference - (progress / 100) * circumference;
    
    progressRing.style.strokeDashoffset = offset;
    document.querySelector('.progress-text').textContent = Math.round(progress) + '%';
}

// Utility Functions
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showWelcomeMessage() {
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'welcome-message';
    welcomeMessage.innerHTML = `
        <div class="welcome-content">
            <h2>Welcome to Immigr-Aid.ai</h2>
            <p>Your AI-powered immigration assistant is ready to help you navigate your immigration journey.</p>
            <button class="btn btn-primary" onclick="this.parentElement.parentElement.remove()">Get Started</button>
        </div>
    `;
    
    document.body.appendChild(welcomeMessage);
    
    setTimeout(() => {
        if (welcomeMessage.parentElement) {
            welcomeMessage.remove();
        }
    }, 5000);
}

function loadPreferences() {
    const savedLanguage = localStorage.getItem('preferredLanguage');
    if (savedLanguage) {
        currentLanguage = savedLanguage;
        document.getElementById('languageSelect').value = savedLanguage;
    }
    
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
        userProfile = JSON.parse(savedProfile);
        profileComplete = true;
        updateProgress();
    }
}

// Translations
const translations = {
    en: {
        languageName: 'English',
        firstNameLabel: 'First Name',
        lastNameLabel: 'Last Name',
        middleNameLabel: 'Middle Name',
        dateOfBirthLabel: 'Date of Birth',
        countryOfBirthLabel: 'Country of Birth',
        currentAddressLabel: 'Current Address',
        phoneNumberLabel: 'Phone Number',
        emailAddressLabel: 'Email Address',
        socialSecurityNumberLabel: 'Social Security Number',
        entryDateLabel: 'Entry Date to US',
        methodOfEntryLabel: 'Method of Entry',
        educationLevelLabel: 'Education Level',
        employmentStatusLabel: 'Employment Status',
        criminalHistoryLabel: 'Criminal History',
        messagePlaceholder: 'Ask me anything about your immigration case...',
        firstNamePlaceholder: 'Enter your first name',
        lastNamePlaceholder: 'Enter your last name',
        addressPlaceholder: 'Enter your current address'
    },
    es: {
        languageName: 'Español',
        firstNameLabel: 'Nombre',
        lastNameLabel: 'Apellido',
        middleNameLabel: 'Segundo Nombre',
        dateOfBirthLabel: 'Fecha de Nacimiento',
        countryOfBirthLabel: 'País de Nacimiento',
        currentAddressLabel: 'Dirección Actual',
        phoneNumberLabel: 'Número de Teléfono',
        emailAddressLabel: 'Dirección de Correo',
        socialSecurityNumberLabel: 'Número de Seguro Social',
        entryDateLabel: 'Fecha de Entrada a EE.UU.',
        methodOfEntryLabel: 'Método de Entrada',
        educationLevelLabel: 'Nivel de Educación',
        employmentStatusLabel: 'Estado de Empleo',
        criminalHistoryLabel: 'Historial Criminal',
        messagePlaceholder: 'Pregúntame cualquier cosa sobre tu caso de inmigración...',
        firstNamePlaceholder: 'Ingresa tu nombre',
        lastNamePlaceholder: 'Ingresa tu apellido',
        addressPlaceholder: 'Ingresa tu dirección actual'
    },
    zh: {
        languageName: '中文',
        firstNameLabel: '名字',
        lastNameLabel: '姓氏',
        middleNameLabel: '中间名',
        dateOfBirthLabel: '出生日期',
        countryOfBirthLabel: '出生国家',
        currentAddressLabel: '当前地址',
        phoneNumberLabel: '电话号码',
        emailAddressLabel: '电子邮件地址',
        socialSecurityNumberLabel: '社会安全号码',
        entryDateLabel: '入境美国日期',
        methodOfEntryLabel: '入境方式',
        educationLevelLabel: '教育水平',
        employmentStatusLabel: '就业状况',
        criminalHistoryLabel: '犯罪历史',
        messagePlaceholder: '询问我任何关于您的移民案件的问题...',
        firstNamePlaceholder: '输入您的名字',
        lastNamePlaceholder: '输入您的姓氏',
        addressPlaceholder: '输入您的当前地址'
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add form submission handler
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveProfile();
        });
    }
});
