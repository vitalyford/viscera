// Direct API approach - no external dependencies needed
class MedicalVisualizationApp {
    constructor() {
        this.currentMode = 'learn';
        this.selectedProcedure = null;
        this.uploadedFiles = [];
        this.isGenerating = false;
        
        // Cache for anatomical descriptions and image descriptions to avoid repeated API calls
        this.anatomicalDescriptions = new Map();
        this.imageDescriptions = new Map();
        
        // Cache for enhanced prompts to avoid re-processing
        this.enhancedPrompts = new Map();
        this.imageAnalysisCache = new Map();
        
        // Pre-fetched anatomical terms for better performance
        this.preFetchedDescriptions = new Map();
        
        // Tooltip element
        this.tooltip = null;
        this.tooltipTimeout = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.initializeTooltip();
        this.setupApiKeyToggle();
        this.initializeImagePopup();
    }

    setupApiKeyToggle() {
        const toggleBtn = document.getElementById('toggle-api-key');
        const apiKeyInput = document.getElementById('api-key-input');
        
        if (toggleBtn && apiKeyInput) {
            toggleBtn.addEventListener('click', () => {
                const isPassword = apiKeyInput.type === 'password';
                apiKeyInput.type = isPassword ? 'text' : 'password';
                toggleBtn.querySelector('.eye-icon').textContent = isPassword ? '🙈' : '👁️';
                toggleBtn.title = isPassword ? 'Hide API key' : 'Show API key';
            });
        }
    }

    getApiKey() {
        const apiKeyInput = document.getElementById('api-key-input');
        return apiKeyInput?.value?.trim() || '';
    }

    validateApiKey() {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            this.showError('Please enter your Gemini API key to continue.');
            document.getElementById('api-key-input')?.focus();
            return false;
        }
        
        // Basic API key format validation for Google AI API keys
        if (!apiKey.startsWith('AIza') || apiKey.length < 30) {
            this.showError('Please enter a valid Gemini API key. It should start with "AIza" and be at least 30 characters long.');
            document.getElementById('api-key-input')?.focus();
            return false;
        }
        
        return true;
    }

    showError(message) {
        // Remove any existing error messages
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        // Create and show new error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        const apiKeySection = document.querySelector('.api-key-section');
        if (apiKeySection) {
            apiKeySection.appendChild(errorDiv);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.remove();
                }
            }, 5000);
        }
    }

    setupEventListeners() {
        // Mode switching
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchMode(e.target.dataset.mode);
            });
        });

        // Procedure selection
        document.querySelectorAll('.procedure-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.selectProcedure(e.currentTarget.dataset.procedure);
            });
        });

        // File upload
        document.getElementById('file-input').addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });

        document.getElementById('upload-area').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        // Generate button
        document.getElementById('generate-btn').addEventListener('click', () => {
            this.generateVisualization();
        });

        // Custom procedure character counter
        const procedureTextarea = document.getElementById('procedure-description');
        if (procedureTextarea) {
            procedureTextarea.addEventListener('input', (e) => {
                this.updateCharCounter(e.target);
            });
        }
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('upload-area');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('dragover');
            }, false);
        });

        uploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFileSelect(files);
        }, false);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    switchMode(mode) {
        this.currentMode = mode;
        
        // Update UI
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        document.querySelectorAll('.mode-content').forEach(content => {
            content.style.display = 'none';
        });

        document.getElementById(`${mode}-mode`).style.display = 'block';
        
        // Reset results when switching modes
        document.getElementById('results').style.display = 'none';
    }

    selectProcedure(procedure) {
        this.selectedProcedure = procedure;
        
        // Update UI
        document.querySelectorAll('.procedure-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.procedure === procedure);
        });

        // Show/hide custom input with animation
        const customInput = document.getElementById('custom-procedure');
        if (procedure === 'custom') {
            customInput.style.display = 'block';
            // Reset character counter and focus on textarea
            setTimeout(() => {
                const textarea = document.getElementById('procedure-description');
                this.updateCharCounter(textarea);
                textarea.focus();
            }, 100);
        } else {
            customInput.style.display = 'none';
        }
    }

    updateCharCounter(textarea) {
        const charCount = document.getElementById('char-count');
        const counter = document.querySelector('.char-counter');
        const currentLength = textarea.value.length;
        const maxLength = 500;
        
        charCount.textContent = currentLength;
        
        // Update counter styling based on character count
        counter.classList.remove('warning', 'danger');
        
        if (currentLength > maxLength * 0.8) {
            counter.classList.add('warning');
        }
        if (currentLength > maxLength) {
            counter.classList.add('danger');
            // Optionally limit the input
            textarea.value = textarea.value.substring(0, maxLength);
            charCount.textContent = maxLength;
        }
    }

    handleFileSelect(files) {
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                this.uploadedFiles.push(file);
                this.displayUploadedImage(file);
            }
        });
    }

    displayUploadedImage(file) {
        const container = document.getElementById('uploaded-images');
        const imageDiv = document.createElement('div');
        imageDiv.className = 'uploaded-image';

        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = file.name;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-image';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = () => {
            this.removeUploadedImage(file, imageDiv);
        };

        imageDiv.appendChild(img);
        imageDiv.appendChild(removeBtn);
        container.appendChild(imageDiv);
    }

    removeUploadedImage(file, element) {
        this.uploadedFiles = this.uploadedFiles.filter(f => f !== file);
        element.remove();
    }

    async generateVisualization() {
        if (this.isGenerating) return;

        // Validate API key first
        if (!this.validateApiKey()) {
            return;
        }

        // Validate inputs
        if (!this.validateInputs()) {
            return;
        }

        this.isGenerating = true;
        this.showLoading();
        
        // Clear any existing description caches for fresh generation
        this.clearDescriptionCaches();

        try {
            const sequenceCount = parseInt(document.getElementById('sequence-count').value);
            const prompts = await this.buildPrompts(sequenceCount);
            
            // Step 1: Generate all base images in parallel
            this.updateProgressWithStatus(10, `Generating ${prompts.length} visualizations...`);
            const imageGenerationPromises = prompts.map((prompt, index) => 
                this.generateTextFreeImageWithPrompt(prompt, index, prompts.length)
            );
            
            const baseImages = await Promise.all(imageGenerationPromises);
            console.log(`Generated ${baseImages.filter(img => img).length} base images successfully`);
            
            // Step 2: Analyze all images in parallel for precise anatomical positioning
            this.updateProgressWithStatus(40, 'Performing detailed anatomical analysis for precise label positioning...');
            const analysisPromises = baseImages.map((imageData, index) => 
                imageData ? this.analyzeLabelPositions(imageData.data, prompts[index]) : null
            );
            
            const analyses = await Promise.all(analysisPromises);
            console.log(`Completed precise anatomical analysis for ${analyses.filter(a => a).length} images`);
            
            // Step 3: Add accurately positioned labels to all images in parallel
            this.updateProgressWithStatus(70, 'Adding medically accurate labels to all visualizations...');
            const overlayPromises = baseImages.map((imageData, index) => 
                imageData && analyses[index] ? 
                    this.addTextOverlays(imageData.data, analyses[index]) : 
                    Promise.resolve(imageData?.data)
            );
            
            const finalImages = await Promise.all(overlayPromises);
            
            // Step 4: Package results
            const images = [];
            finalImages.forEach((imageData, index) => {
                if (imageData) {
                    images.push({
                        data: imageData,
                        step: index + 1,
                        description: this.getStepDescription(index, sequenceCount),
                        labels: analyses[index]?.labels || []
                    });
                }
            });

            if (images.length > 0) {
                this.updateProgressWithStatus(100, 'Finalizing visualizations and generating detailed explanations...');
                console.log(`Generation complete: ${images.length} medical visualizations with anatomically precise labels and dynamic descriptions ready (processed in parallel)`);
                this.displayResults(images);
            } else {
                throw new Error('No images were generated');
            }
        } catch (error) {
            console.error('Generation error:', error);
            alert('Error generating visualization. Please check your inputs and try again.');
        } finally {
            this.isGenerating = false;
            this.hideLoading();
        }
    }

    validateInputs() {
        if (this.currentMode === 'learn') {
            if (!this.selectedProcedure) {
                alert('Please select a medical procedure to visualize.');
                return false;
            }
            if (this.selectedProcedure === 'custom') {
                const description = document.getElementById('procedure-description').value.trim();
                if (!description) {
                    alert('Please describe the custom procedure you want to visualize.');
                    return false;
                }
            }
        } else {
            const query = document.getElementById('personal-query').value.trim();
            if (!query) {
                alert('Please describe what you want to understand about your medical condition.');
                return false;
            }
        }
        return true;
    }

    async buildPrompts(sequenceCount) {
        const basePrompt = this.getBasePrompt();
        const prompts = [];

        // Add progress update for prompt enhancement
        if (this.currentMode === 'learn' && this.selectedProcedure === 'custom' && basePrompt.trim()) {
            this.updateProgressWithStatus(5, 'Enhancing your procedure description with medical terminology...');
        } else if (this.currentMode === 'personal' && basePrompt.trim()) {
            if (this.uploadedFiles.length > 0) {
                this.updateProgressWithStatus(5, 'Analyzing uploaded images and enhancing prompt...');
            } else {
                this.updateProgressWithStatus(5, 'Enhancing your description with medical terminology...');
            }
        }

        if (this.currentMode === 'learn') {
            // Generate educational sequence
            for (let i = 0; i < sequenceCount; i++) {
                const step = i + 1;
                const stepPrompt = await this.buildEducationalPrompt(basePrompt, step, sequenceCount);
                prompts.push(stepPrompt);
            }
        } else {
            // Generate personal medical imagery sequence
            for (let i = 0; i < sequenceCount; i++) {
                const step = i + 1;
                const stepPrompt = await this.buildPersonalPrompt(basePrompt, step, sequenceCount);
                prompts.push(stepPrompt);
            }
        }

        return prompts;
    }

    getBasePrompt() {
        if (this.currentMode === 'learn') {
            if (this.selectedProcedure === 'custom') {
                return document.getElementById('procedure-description').value.trim();
            } else {
                return this.getPredefinedProcedurePrompt(this.selectedProcedure);
            }
        } else {
            return document.getElementById('personal-query').value.trim();
        }
    }

    getPredefinedProcedurePrompt(procedure) {
        const prompts = {
            'knee-replacement': 'total knee replacement surgery procedure',
            'heart-surgery': 'cardiac bypass surgery procedure',
            'cataract-surgery': 'cataract removal and intraocular lens implantation surgery',
            'appendectomy': 'laparoscopic appendectomy surgical procedure',
            'dental-implant': 'dental implant placement procedure',
            'gallbladder-surgery': 'laparoscopic cholecystectomy gallbladder removal surgery',
            'hip-replacement': 'total hip replacement surgery procedure'
        };
        return prompts[procedure] || procedure;
    }

    async buildEducationalPrompt(basePrompt, step, totalSteps) {
        // Enhance the base prompt with medical terminology if it's a custom procedure
        let enhancedBasePrompt = basePrompt;
        if (this.selectedProcedure === 'custom' && basePrompt.trim()) {
            enhancedBasePrompt = await this.enhancePromptWithMedicalTerms(basePrompt, 'educational');
        }
        
        const stepDescriptions = this.getEducationalStepDescriptions(step, totalSteps);
        
        return `Create a clear, detailed medical illustration showing ${enhancedBasePrompt} - ${stepDescriptions}. 
        Make it photorealistic but appropriate for patient education, showing anatomical details clearly. 
        Use cross-sectional or cutaway views when helpful. Focus on visual clarity of anatomical structures. 
        The image should be educational, professional, and help patients understand their medical procedure. 
        Step ${step} of ${totalSteps}. Important: Create the image without any text or labels - they will be added separately.`;
    }

    getEducationalStepDescriptions(step, totalSteps) {
        const percentage = ((step - 1) / Math.max(1, totalSteps - 1)) * 100;
        
        if (totalSteps === 1) {
            return 'complete procedure overview';
        } else if (totalSteps === 3) {
            const descriptions = [
                'normal anatomy before the procedure',
                'during the surgical intervention',
                'final result after healing'
            ];
            return descriptions[step - 1];
        } else {
            if (percentage <= 20) {
                return 'normal anatomy before the procedure';
            } else if (percentage <= 40) {
                return 'initial surgical preparation and incision';
            } else if (percentage <= 60) {
                return 'main surgical intervention in progress';
            } else if (percentage <= 80) {
                return 'surgical completion and closure';
            } else {
                return 'final healed result and recovery';
            }
        }
    }

    async buildPersonalPrompt(basePrompt, step, totalSteps) {
        const prompt = [];
        
        // First, analyze uploaded images to understand what they show
        const imageAnalysis = await this.analyzeUploadedImages();
        
        // Enhance the user's prompt based on image analysis and medical terminology
        let enhancedBasePrompt = basePrompt;
        if (basePrompt.trim()) {
            if (imageAnalysis) {
                enhancedBasePrompt = await this.enhancePersonalPromptWithImageContext(basePrompt, imageAnalysis);
            } else {
                enhancedBasePrompt = await this.enhancePromptWithMedicalTerms(basePrompt, 'clinical');
            }
        }
        
        const stepDesc = this.getPersonalStepDescription(step, totalSteps);
        prompt.push({ 
            text: `Based on the provided medical images, create a visualization that helps explain: ${enhancedBasePrompt}. 
            Focus on ${stepDesc}. Create a clear, patient-friendly visualization that helps explain the medical situation. 
            Make it educational and reassuring while being medically accurate. Step ${step} of ${totalSteps}. 
            Important: Generate the image without any text or labels - they will be added separately for clarity.` 
        });

        // Add uploaded images
        for (const file of this.uploadedFiles) {
            const base64Data = await this.fileToBase64(file);
            prompt.push({
                inlineData: {
                    mimeType: file.type,
                    data: base64Data
                }
            });
        }

        return prompt;
    }

    getPersonalStepDescription(step, totalSteps) {
        const percentage = ((step - 1) / Math.max(1, totalSteps - 1)) * 100;
        
        if (totalSteps === 1) {
            return 'the current condition and what it means';
        } else if (percentage <= 33) {
            return 'the current condition as shown in the images';
        } else if (percentage <= 66) {
            return 'the treatment process and what will happen';
        } else {
            return 'the expected outcome and recovery';
        }
    }

    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async enhancePromptWithMedicalTerms(userPrompt, mode = 'educational') {
        // Check cache first
        const cacheKey = `enhance-${mode}-${userPrompt}`;
        if (this.enhancedPrompts.has(cacheKey)) {
            return this.enhancedPrompts.get(cacheKey);
        }

        try {
            const enhancementPrompt = `You are a medical imaging specialist. Enhance the following user prompt by adding appropriate medical terminology, anatomical specificity, and technical details that would help generate accurate medical visualizations.

User's original prompt: "${userPrompt}"

Instructions:
- Keep the user's core intent intact
- Add specific anatomical terms where appropriate
- Include relevant medical terminology
- Make the description more detailed for better image generation
- Focus on ${mode === 'educational' ? 'educational clarity and patient understanding' : 'clinical accuracy and diagnostic detail'}
- Specify visual elements like cross-sections, anatomical orientations, or surgical views when relevant
- Ensure the enhanced prompt is suitable for medical image generation

Enhanced prompt:`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.getApiKey()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: enhancementPrompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 500
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const enhancedPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            
            if (enhancedPrompt) {
                console.log('Original prompt:', userPrompt);
                console.log('Enhanced prompt:', enhancedPrompt);
                
                // Cache the result
                this.enhancedPrompts.set(cacheKey, enhancedPrompt);
                return enhancedPrompt;
            } else {
                console.warn('Failed to enhance prompt, using original');
                return userPrompt;
            }
        } catch (error) {
            console.error('Error enhancing prompt:', error);
            return userPrompt; // Fall back to original prompt
        }
    }

    async analyzeUploadedImages() {
        if (this.uploadedFiles.length === 0) {
            return null;
        }

        // Create cache key based on file info
        const fileInfo = this.uploadedFiles.map(f => `${f.name}-${f.size}-${f.lastModified}`).join('|');
        const cacheKey = `analysis-${fileInfo}`;
        
        if (this.imageAnalysisCache.has(cacheKey)) {
            return this.imageAnalysisCache.get(cacheKey);
        }

        try {
            const analysisPrompt = `Analyze the provided medical image(s) and provide a detailed description including:
1. Type of medical imaging (X-ray, CT, MRI, ultrasound, photograph, etc.)
2. Anatomical region or body part shown
3. Any visible medical conditions, abnormalities, or findings
4. Relevant anatomical structures visible
5. Clinical context if apparent

Be specific and use proper medical terminology. This analysis will be used to enhance user prompts for generating educational medical visualizations.

Medical image analysis:`;

            const prompt = [{ text: analysisPrompt }];
            
            // Add all uploaded images to the analysis
            for (const file of this.uploadedFiles) {
                const base64Data = await this.fileToBase64(file);
                prompt.push({
                    inlineData: {
                        mimeType: file.type,
                        data: base64Data
                    }
                });
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.getApiKey()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: prompt
                    }],
                    generationConfig: {
                        temperature: 0.3, // Lower temperature for more factual analysis
                        maxOutputTokens: 800
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const analysis = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            
            if (analysis) {
                console.log('Image analysis:', analysis);
                // Cache the result
                this.imageAnalysisCache.set(cacheKey, analysis);
                return analysis;
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error analyzing uploaded images:', error);
            return null;
        }
    }

    async enhancePersonalPromptWithImageContext(userPrompt, imageAnalysis) {
        // Create cache key based on prompt and analysis
        const cacheKey = `personal-enhance-${userPrompt}-${imageAnalysis}`;
        if (this.enhancedPrompts.has(cacheKey)) {
            return this.enhancedPrompts.get(cacheKey);
        }

        try {
            const enhancementPrompt = `You are a medical imaging specialist. Based on the analysis of uploaded medical images and the user's prompt, create an enhanced prompt for generating educational medical visualizations.

Image Analysis: "${imageAnalysis}"

User's Original Prompt: "${userPrompt}"

Instructions:
- Combine the medical findings from the image analysis with the user's intent
- Add specific anatomical and medical terminology
- Include relevant clinical context from the image analysis
- Make the prompt detailed enough for accurate medical image generation
- Focus on patient education while maintaining clinical accuracy
- Specify visual elements that would help explain the medical condition
- Ensure the enhanced prompt creates visualizations that complement the uploaded images

Enhanced prompt for medical visualization:`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.getApiKey()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: enhancementPrompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 600
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const enhancedPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            
            if (enhancedPrompt) {
                console.log('Enhanced personal prompt:', enhancedPrompt);
                // Cache the result
                this.enhancedPrompts.set(cacheKey, enhancedPrompt);
                return enhancedPrompt;
            } else {
                console.warn('Failed to enhance personal prompt, using original');
                return userPrompt;
            }
        } catch (error) {
            console.error('Error enhancing personal prompt:', error);
            return userPrompt;
        }
    }

    async generateSingleImage(prompt) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${this.getApiKey()}`;
            
            let requestBody;
            if (typeof prompt === 'string') {
                // Text-only prompt
                requestBody = {
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                };
            } else {
                // Mixed content (text + images)
                requestBody = {
                    contents: [{
                        parts: prompt
                    }]
                };
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Look for inline data (images) in the response
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                for (const part of data.candidates[0].content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        return part.inlineData.data;
                    }
                }
            }
            
            throw new Error('No image data found in response');
        } catch (error) {
            console.error('Error generating image:', error);
            throw error;
        }
    }

    async generateTextFreeImageWithPrompt(prompt, index, total) {
        try {
            const textFreePrompt = this.createTextFreePrompt(prompt);
            const imageData = await this.generateSingleImage(textFreePrompt);
            console.log(`Base image ${index + 1}/${total} generated successfully`);
            return { data: imageData, index: index };
        } catch (error) {
            console.error(`Error generating base image ${index + 1}:`, error);
            return null;
        }
    }

    createTextFreePrompt(originalPrompt) {
        let baseContent = '';
        if (typeof originalPrompt === 'string') {
            baseContent = originalPrompt;
        } else if (Array.isArray(originalPrompt)) {
            const textParts = originalPrompt.filter(part => part.text);
            baseContent = textParts.map(part => part.text).join(' ');
        }

        return `${baseContent}

ABSOLUTELY CRITICAL INSTRUCTION: Generate this medical visualization as a COMPLETELY TEXT-FREE, LABEL-FREE image. This is a strict requirement - NO TEXT OF ANY KIND should appear in the image.

STRICTLY FORBIDDEN - Do not include:
- Any text labels, captions, or annotations
- Medical terminology written anywhere on the image
- Numbers, letters, symbols, or characters
- Arrows with text
- Watermarks or signatures
- Any readable text whatsoever in any language
- Medical abbreviations or acronyms
- Measurement units or scales with text
- Legends or keys with text

REQUIRED: Create a pure visual medical illustration showing only:
- Anatomical structures in clear detail
- Visual indicators (arrows, highlighting, color coding)
- Cross-sections or cutaway views
- Realistic medical imagery without any textual elements

The image must be completely clean of text because labels will be added programmatically later. Focus entirely on creating an accurate, detailed visual representation that communicates through imagery alone, not text.`;
    }

    /**
     * Analyzes medical images for anatomically accurate label positioning using a two-step process:
     * 1. Identifies anatomical structures with medical precision
     * 2. Refines coordinates to ensure accurate anatomical positioning
     * This prevents labels from pointing to incorrect anatomical structures.
     */
    async analyzeLabelPositions(imageData, originalPrompt) {
        try {
            // Step 1: Identify anatomical structures with precise medical analysis
            const structureAnalysis = await this.identifyAnatomicalStructures(imageData, originalPrompt);
            
            if (!structureAnalysis || structureAnalysis.labels.length === 0) {
                console.warn('No anatomical structures identified');
                return { labels: [], description: 'No anatomical structures identified' };
            }
            
            // Step 2: Refine coordinates for medical accuracy
            const refinedAnalysis = await this.refineAnatomicalCoordinates(imageData, structureAnalysis, originalPrompt);
            
            return refinedAnalysis;
        } catch (error) {
            console.warn('Error during label analysis:', error);
            return { labels: [], description: 'Analysis error - using image without labels' };
        }
    }

    async identifyAnatomicalStructures(imageData, originalPrompt) {
        try {
            const identificationPrompt = this.createAnatomicalIdentificationPrompt(originalPrompt);
            
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.getApiKey()}`;
            
            const requestBody = {
                contents: [{
                    parts: [
                        { text: identificationPrompt },
                        {
                            inlineData: {
                                mimeType: "image/png",
                                data: imageData
                            }
                        }
                    ]
                }]
            };

            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.warn(`Structure identification failed with status: ${response.status}`);
                return { labels: [], description: 'Structure identification failed' };
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                const analysisText = data.candidates[0].content.parts[0].text;
                const result = this.parseLabelAnalysis(analysisText);
                console.log(`Identified ${result.labels.length} anatomical structures`);
                return result;
            }
            
            return { labels: [], description: 'No structure data returned' };
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('Structure identification timeout');
                return { labels: [], description: 'Structure identification timeout' };
            }
            console.warn('Error during structure identification:', error);
            return { labels: [], description: 'Structure identification error' };
        }
    }

    async refineAnatomicalCoordinates(imageData, initialAnalysis, originalPrompt) {
        try {
            const refinementPrompt = this.createCoordinateRefinementPrompt(originalPrompt, initialAnalysis);
            
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.getApiKey()}`;
            
            const requestBody = {
                contents: [{
                    parts: [
                        { text: refinementPrompt },
                        {
                            inlineData: {
                                mimeType: "image/png",
                                data: imageData
                            }
                        }
                    ]
                }]
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                console.warn(`Coordinate refinement failed with status: ${response.status}`);
                // Fall back to initial analysis if refinement fails
                return initialAnalysis;
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                const refinedText = data.candidates[0].content.parts[0].text;
                const refinedAnalysis = this.parseLabelAnalysis(refinedText);
                
                // If refinement produced valid results, use them; otherwise use initial analysis
                return refinedAnalysis.labels.length > 0 ? refinedAnalysis : initialAnalysis;
            }
            
            return initialAnalysis;
        } catch (error) {
            console.warn('Error during coordinate refinement:', error);
            // Fall back to initial analysis if refinement fails
            return initialAnalysis;
        }
    }

    createLabelAnalysisPrompt(originalPrompt) {
        let baseContent = '';
        if (typeof originalPrompt === 'string') {
            baseContent = originalPrompt;
        } else if (Array.isArray(originalPrompt)) {
            const textParts = originalPrompt.filter(part => part.text);
            baseContent = textParts.map(part => part.text).join(' ');
        }

        return `Analyze this medical visualization image and identify where text labels should be placed. The image should show medical structures that need labeling.

Based on the original request: ${baseContent}

Please identify:
1. Key anatomical structures visible in the image (limit to 3-6 most important structures to avoid overcrowding)
2. Where labels should be positioned with adequate spacing between them (approximate percentages from top-left corner)
3. What the correct medical terminology should be for each label
4. Ensure label positions are well-distributed across the image to prevent overlap

Respond in this exact format:
LABELS:
[Structure1]: [correct medical term] at position [X%,Y%]
[Structure2]: [correct medical term] at position [X%,Y%]
...

DESCRIPTION: [Brief description of what the image shows]

Example:
LABELS:
Heart: Cardiac muscle at position 45%,50%
Aorta: Ascending aorta at position 40%,30%
DESCRIPTION: Cross-section view of the heart showing major blood vessels`;
    }

    createAnatomicalIdentificationPrompt(originalPrompt) {
        let baseContent = '';
        if (typeof originalPrompt === 'string') {
            baseContent = originalPrompt;
        } else if (Array.isArray(originalPrompt)) {
            const textParts = originalPrompt.filter(part => part.text);
            baseContent = textParts.map(part => part.text).join(' ');
        }

        return `You are a medical imaging specialist. Analyze this medical visualization and identify anatomical structures with precise medical accuracy.

Original medical context: ${baseContent}

CRITICAL MEDICAL ACCURACY REQUIREMENTS:
1. Only identify structures that are clearly visible and distinguishable in the image
2. Use precise medical terminology (e.g., "internal jugular vein" not just "vein")
3. Consider the anatomical context and relationships between structures
4. Distinguish between similar-looking structures (muscle vs. vessel vs. nerve vs. organ)
5. Account for the specific medical view/orientation shown (anterior/posterior, sagittal, coronal, etc.)

Your task: Identify 3-5 of the most educationally important anatomical structures visible in this image. Focus on:
- Key organs or organ systems relevant to the medical context
- Major blood vessels if this is a vascular procedure
- Important nerves if this is a neurological context
- Bone structures if this is orthopedic
- Tissue layers if this is a surgical context

For each structure, provide:
1. Exact medical name
2. Brief description of what makes it identifiable
3. Approximate location (percentage coordinates from top-left)

Respond in this exact format:
STRUCTURES:
[Precise Medical Name]: [identifying characteristics] at position [X%,Y%]
[Precise Medical Name]: [identifying characteristics] at position [X%,Y%]
...

DESCRIPTION: [Brief description of the anatomical view and context]

Example:
STRUCTURES:
Internal jugular vein: Large venous structure lateral to carotid artery at position 35%,45%
Sternocleidomastoid muscle: Prominent neck muscle with characteristic fiber orientation at position 25%,55%
DESCRIPTION: Lateral neck anatomy showing vascular and muscular structures`;
    }

    createCoordinateRefinementPrompt(originalPrompt, initialAnalysis) {
        let baseContent = '';
        if (typeof originalPrompt === 'string') {
            baseContent = originalPrompt;
        } else if (Array.isArray(originalPrompt)) {
            const textParts = originalPrompt.filter(part => part.text);
            baseContent = textParts.map(part => part.text).join(' ');
        }

        const structuresList = initialAnalysis.labels.map(label => 
            `${label.text} at ${label.x}%,${label.y}%`
        ).join('\n');

        return `You are a medical anatomy expert performing coordinate verification. Review and refine the anatomical structure locations for maximum medical accuracy.

Original medical context: ${baseContent}
Initial structure identification:
${structuresList}

MEDICAL ACCURACY VERIFICATION TASK:
Carefully examine each identified structure and verify its coordinates are pointing to the correct anatomical location:

1. PRECISE LOCATION CHECK: Ensure each coordinate points to the actual center/most representative part of that anatomical structure
2. ANATOMICAL RELATIONSHIPS: Verify the spatial relationships between structures make medical sense
3. STRUCTURE BOUNDARIES: Ensure coordinates are within the actual structure, not adjacent tissue
4. MEDICAL CONTEXT: Confirm the locations align with the medical procedure/condition being illustrated

For each structure, either:
- CONFIRM the coordinates if they are medically accurate
- ADJUST the coordinates if they need refinement for anatomical precision
- REMOVE the structure if it's not clearly visible or incorrectly identified

Provide refined coordinates with medical justification:

REFINED_LABELS:
[Structure Name]: [Medical justification for position] at position [X%,Y%]
[Structure Name]: [Medical justification for position] at position [X%,Y%]
...

DESCRIPTION: [Updated description emphasizing anatomical accuracy]

Example:
REFINED_LABELS:
Internal jugular vein: Central lumen of vein, medial to sternocleidomastoid at position 38%,42%
Carotid artery: Arterial wall clearly visible, medial to jugular vein at position 45%,44%
DESCRIPTION: Refined neck anatomy with precise vascular structure locations`;
    }

    parseLabelAnalysis(analysisText) {
        try {
            const lines = analysisText.split('\n');
            const analysis = {
                labels: [],
                description: ''
            };

            let inLabelsSection = false;
            let sectionType = '';
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                
                // Check for section headers
                if (trimmedLine.startsWith('LABELS:') || trimmedLine.startsWith('STRUCTURES:') || trimmedLine.startsWith('REFINED_LABELS:')) {
                    inLabelsSection = true;
                    sectionType = trimmedLine.split(':')[0];
                    continue;
                } else if (trimmedLine.startsWith('DESCRIPTION:')) {
                    inLabelsSection = false;
                    analysis.description = trimmedLine.replace('DESCRIPTION:', '').trim();
                    continue;
                }
                
                if (inLabelsSection && trimmedLine.includes('at position')) {
                    // Handle different formats:
                    // Format 1: "Structure: Description at position X%,Y%"
                    // Format 2: "Structure Name: Detailed description at position X%,Y%"
                    
                    const positionMatch = trimmedLine.match(/at position\s+(\d+)%,(\d+)%/);
                    if (positionMatch) {
                        const beforePosition = trimmedLine.substring(0, trimmedLine.indexOf('at position')).trim();
                        
                        // Split on the first colon to separate structure name from description
                        const colonIndex = beforePosition.indexOf(':');
                        if (colonIndex > -1) {
                            const structureName = beforePosition.substring(0, colonIndex).trim();
                            const description = beforePosition.substring(colonIndex + 1).trim();
                            
                            analysis.labels.push({
                                structure: structureName,
                                text: structureName, // Use structure name as the label text
                                description: description,
                                x: parseInt(positionMatch[1]),
                                y: parseInt(positionMatch[2])
                            });
                        } else {
                            // Fallback: try to extract structure name from the whole line
                            const words = beforePosition.split(/\s+/);
                            const structureName = words.slice(0, Math.min(3, words.length)).join(' ');
                            
                            analysis.labels.push({
                                structure: structureName,
                                text: structureName,
                                description: beforePosition,
                                x: parseInt(positionMatch[1]),
                                y: parseInt(positionMatch[2])
                            });
                        }
                    }
                }
            }

            // Log parsing results for debugging
            console.log(`Parsed ${analysis.labels.length} labels from ${sectionType} section`);
            
            return analysis;
        } catch (error) {
            console.warn('Error parsing label analysis:', error);
            return { labels: [], description: 'Label analysis parsing failed' };
        }
    }

    async addTextOverlays(imageData, labelAnalysis) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Set canvas size to match image
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw the base image
                ctx.drawImage(img, 0, 0);
                
                // Add modern text overlays with lines
                if (labelAnalysis && labelAnalysis.labels) {
                    this.addModernLabels(ctx, labelAnalysis.labels, canvas.width, canvas.height);
                }
                
                // Convert canvas to base64
                const finalImageData = canvas.toDataURL('image/png').split(',')[1];
                resolve(finalImageData);
            };
            img.src = `data:image/png;base64,${imageData}`;
        });
    }

    addModernLabels(ctx, labels, canvasWidth, canvasHeight) {
        // Add roundRect polyfill if not available
        if (!ctx.roundRect) {
            ctx.roundRect = function(x, y, width, height, radius) {
                this.beginPath();
                this.moveTo(x + radius, y);
                this.lineTo(x + width - radius, y);
                this.quadraticCurveTo(x + width, y, x + width, y + radius);
                this.lineTo(x + width, y + height - radius);
                this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
                this.lineTo(x + radius, y + height);
                this.quadraticCurveTo(x, y + height, x, y + height - radius);
                this.lineTo(x, y + radius);
                this.quadraticCurveTo(x, y, x + radius, y);
                this.closePath();
            };
        }
        
        // Modern styling configuration
        const config = {
            fontSize: Math.max(18, Math.min(24, canvasWidth / 40)), // Responsive font size
            fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            textColor: '#2c3e50',
            lineColor: '#3498db',
            backgroundColor: '#ffffff',
            shadowColor: 'rgba(0, 0, 0, 0.1)',
            padding: 12,
            borderRadius: 8,
            lineWidth: 2,
            dotSize: 6
        };

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `600 ${config.fontSize}px ${config.fontFamily}`;

        // Track placed labels to prevent overlaps
        const placedLabels = [];

        labels.forEach((label, index) => {
            const pointX = (label.x / 100) * canvasWidth;
            const pointY = (label.y / 100) * canvasHeight;
            
            // Measure text to determine label box size
            const textMetrics = ctx.measureText(label.text);
            const textWidth = textMetrics.width;
            const textHeight = config.fontSize;
            
            // Calculate optimal label position without overlaps
            const labelPosition = this.calculateOptimalLabelPositionWithoutOverlap(
                pointX, pointY, textWidth, textHeight, config.padding, 
                canvasWidth, canvasHeight, index, placedLabels
            );
            
            // Add this label to the placed labels list
            placedLabels.push({
                x: labelPosition.boxX,
                y: labelPosition.boxY,
                width: labelPosition.boxWidth,
                height: labelPosition.boxHeight
            });
            
            // Draw connecting line with modern style
            this.drawModernConnectorLine(ctx, pointX, pointY, labelPosition, config);
            
            // Draw modern label background
            this.drawModernLabelBackground(ctx, labelPosition, textWidth, textHeight, config);
            
            // Draw the text
            ctx.fillStyle = config.textColor;
            ctx.fillText(label.text, labelPosition.textX, labelPosition.textY);
            
            // Draw point indicator
            this.drawModernPoint(ctx, pointX, pointY, config);
        });
    }

    calculateOptimalLabelPositionWithoutOverlap(pointX, pointY, textWidth, textHeight, padding, canvasWidth, canvasHeight, index, placedLabels) {
        const boxWidth = textWidth + (padding * 2);
        const boxHeight = textHeight + (padding * 2);
        const offset = 40; // Distance from point to label
        const minSeparation = 10; // Minimum distance between labels
        
        // Try different positions in order of preference with multiple offsets
        const basePositions = [
            { x: pointX + offset, y: pointY - offset, anchor: 'top-right' },
            { x: pointX - offset - boxWidth, y: pointY - offset, anchor: 'top-left' },
            { x: pointX + offset, y: pointY + offset, anchor: 'bottom-right' },
            { x: pointX - offset - boxWidth, y: pointY + offset, anchor: 'bottom-left' },
            { x: pointX - boxWidth/2, y: pointY - offset - boxHeight, anchor: 'top' },
            { x: pointX - boxWidth/2, y: pointY + offset, anchor: 'bottom' }
        ];
        
        // Try multiple radial distances for each position
        const distances = [offset, offset + 30, offset + 60, offset + 90];
        
        for (let distance of distances) {
            for (let pos of basePositions) {
                // Calculate position with current distance
                let adjustedX, adjustedY;
                switch(pos.anchor) {
                    case 'top-right':
                        adjustedX = pointX + distance;
                        adjustedY = pointY - distance;
                        break;
                    case 'top-left':
                        adjustedX = pointX - distance - boxWidth;
                        adjustedY = pointY - distance;
                        break;
                    case 'bottom-right':
                        adjustedX = pointX + distance;
                        adjustedY = pointY + distance;
                        break;
                    case 'bottom-left':
                        adjustedX = pointX - distance - boxWidth;
                        adjustedY = pointY + distance;
                        break;
                    case 'top':
                        adjustedX = pointX - boxWidth/2;
                        adjustedY = pointY - distance - boxHeight;
                        break;
                    case 'bottom':
                        adjustedX = pointX - boxWidth/2;
                        adjustedY = pointY + distance;
                        break;
                    default:
                        adjustedX = pos.x;
                        adjustedY = pos.y;
                }
                
                // Check if this position fits within canvas bounds
                if (adjustedX >= 0 && adjustedY >= 0 && 
                    adjustedX + boxWidth <= canvasWidth && 
                    adjustedY + boxHeight <= canvasHeight) {
                    
                    // Check for overlaps with existing labels
                    const wouldOverlap = placedLabels.some(existing => 
                        this.rectanglesOverlap(
                            adjustedX, adjustedY, boxWidth, boxHeight,
                            existing.x - minSeparation, existing.y - minSeparation, 
                            existing.width + (minSeparation * 2), existing.height + (minSeparation * 2)
                        )
                    );
                    
                    if (!wouldOverlap) {
                        return {
                            boxX: adjustedX,
                            boxY: adjustedY,
                            textX: adjustedX + padding,
                            textY: adjustedY + boxHeight/2,
                            boxWidth: boxWidth,
                            boxHeight: boxHeight
                        };
                    }
                }
            }
        }
        
        // If no non-overlapping position found, try spiral placement
        return this.findSpiralPosition(pointX, pointY, boxWidth, boxHeight, padding, canvasWidth, canvasHeight, placedLabels, minSeparation);
    }

    rectanglesOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
        return !(x1 + w1 <= x2 || x2 + w2 <= x1 || y1 + h1 <= y2 || y2 + h2 <= y1);
    }

    findSpiralPosition(centerX, centerY, boxWidth, boxHeight, padding, canvasWidth, canvasHeight, placedLabels, minSeparation) {
        const maxRadius = Math.min(canvasWidth, canvasHeight) / 2;
        const angleStep = Math.PI / 8; // 22.5 degrees
        
        for (let radius = 50; radius <= maxRadius; radius += 20) {
            for (let angle = 0; angle < 2 * Math.PI; angle += angleStep) {
                const x = centerX + radius * Math.cos(angle) - boxWidth/2;
                const y = centerY + radius * Math.sin(angle) - boxHeight/2;
                
                // Check bounds
                if (x >= 0 && y >= 0 && x + boxWidth <= canvasWidth && y + boxHeight <= canvasHeight) {
                    // Check overlaps
                    const wouldOverlap = placedLabels.some(existing => 
                        this.rectanglesOverlap(
                            x, y, boxWidth, boxHeight,
                            existing.x - minSeparation, existing.y - minSeparation, 
                            existing.width + (minSeparation * 2), existing.height + (minSeparation * 2)
                        )
                    );
                    
                    if (!wouldOverlap) {
                        return {
                            boxX: x,
                            boxY: y,
                            textX: x + padding,
                            textY: y + boxHeight/2,
                            boxWidth: boxWidth,
                            boxHeight: boxHeight
                        };
                    }
                }
            }
        }
        
        // Final fallback: place at a safe position even if it might overlap slightly
        const safeX = Math.max(0, Math.min(centerX - boxWidth/2, canvasWidth - boxWidth));
        const safeY = Math.max(0, Math.min(centerY - boxHeight/2, canvasHeight - boxHeight));
        
        return {
            boxX: safeX,
            boxY: safeY,
            textX: safeX + padding,
            textY: safeY + boxHeight/2,
            boxWidth: boxWidth,
            boxHeight: boxHeight
        };
    }

    // Keep the old function for backward compatibility but rename it
    calculateOptimalLabelPosition(pointX, pointY, textWidth, textHeight, padding, canvasWidth, canvasHeight, index) {
        const boxWidth = textWidth + (padding * 2);
        const boxHeight = textHeight + (padding * 2);
        const offset = 40; // Distance from point to label
        
        // Try different positions in order of preference
        const positions = [
            { x: pointX + offset, y: pointY - offset, anchor: 'top-right' },    // Top-right
            { x: pointX - offset - boxWidth, y: pointY - offset, anchor: 'top-left' },     // Top-left
            { x: pointX + offset, y: pointY + offset, anchor: 'bottom-right' }, // Bottom-right
            { x: pointX - offset - boxWidth, y: pointY + offset, anchor: 'bottom-left' },  // Bottom-left
            { x: pointX - boxWidth/2, y: pointY - offset - boxHeight, anchor: 'top' },     // Top
            { x: pointX - boxWidth/2, y: pointY + offset, anchor: 'bottom' }               // Bottom
        ];
        
        // Offset positions slightly to avoid overlap
        const stagger = (index % 3) * 15;
        
        for (let pos of positions) {
            const adjustedX = pos.x + (pos.anchor.includes('right') ? stagger : -stagger);
            const adjustedY = pos.y + stagger;
            
            // Check if this position fits within canvas bounds
            if (adjustedX >= 0 && adjustedY >= 0 && 
                adjustedX + boxWidth <= canvasWidth && 
                adjustedY + boxHeight <= canvasHeight) {
                
                return {
                    boxX: adjustedX,
                    boxY: adjustedY,
                    textX: adjustedX + padding,
                    textY: adjustedY + boxHeight/2,
                    boxWidth: boxWidth,
                    boxHeight: boxHeight
                };
            }
        }
        
        // Fallback: force fit within bounds
        const safeX = Math.max(0, Math.min(pointX - boxWidth/2, canvasWidth - boxWidth));
        const safeY = Math.max(0, Math.min(pointY - boxHeight/2, canvasHeight - boxHeight));
        
        return {
            boxX: safeX,
            boxY: safeY,
            textX: safeX + padding,
            textY: safeY + boxHeight/2,
            boxWidth: boxWidth,
            boxHeight: boxHeight
        };
    }

    drawModernConnectorLine(ctx, pointX, pointY, labelPosition, config) {
        const startX = pointX;
        const startY = pointY;
        const endX = labelPosition.boxX + (labelPosition.boxWidth / 2);
        const endY = labelPosition.boxY + (labelPosition.boxHeight / 2);
        
        // Create elegant curved line
        ctx.beginPath();
        ctx.strokeStyle = config.lineColor;
        ctx.lineWidth = config.lineWidth;
        ctx.lineCap = 'round';
        
        // Calculate control points for smooth curve
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        const controlOffset = 20;
        
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(
            midX + controlOffset, midY - controlOffset,
            endX, endY
        );
        ctx.stroke();
    }

    drawModernLabelBackground(ctx, position, textWidth, textHeight, config) {
        // Draw shadow first
        ctx.save();
        ctx.shadowColor = config.shadowColor;
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // Draw rounded rectangle background
        ctx.beginPath();
        ctx.roundRect(
            position.boxX, position.boxY, 
            position.boxWidth, position.boxHeight, 
            config.borderRadius
        );
        ctx.fillStyle = config.backgroundColor;
        ctx.fill();
        
        // Add subtle border
        ctx.strokeStyle = '#e1e8ed';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
    }

    drawModernPoint(ctx, x, y, config) {
        // Draw outer ring
        ctx.beginPath();
        ctx.arc(x, y, config.dotSize + 2, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = config.lineColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw inner dot
        ctx.beginPath();
        ctx.arc(x, y, config.dotSize, 0, 2 * Math.PI);
        ctx.fillStyle = config.lineColor;
        ctx.fill();
    }

    getStepDescription(stepIndex, totalSteps) {
        if (this.currentMode === 'learn') {
            const procedure = this.selectedProcedure;
            const stepDescriptions = this.getProcedureStepDescriptions(procedure);
            
            if (totalSteps <= 3 && stepDescriptions[stepIndex]) {
                return stepDescriptions[stepIndex];
            } else {
                return this.getGenericStepDescription(stepIndex, totalSteps, 'educational');
            }
        } else {
            return this.getGenericStepDescription(stepIndex, totalSteps, 'personal');
        }
    }

    getProcedureStepDescriptions(procedure) {
        const descriptions = {
            'knee-replacement': [
                'detailed anatomical cross-section of a normal knee joint showing the femur, tibia, patella, articular cartilage, meniscus, synovial fluid, and supporting ligaments (ACL, PCL, MCL, LCL). Display healthy white cartilage surfaces, clear joint space, and intact bone structure. Medical illustration style with clear anatomical detail',
                'orthopedic surgical procedure showing total knee arthroplasty in progress. Surgeon removing damaged articular cartilage and subchondral bone from femoral condyles and tibial plateau using specialized surgical instruments. Show exposed bone surfaces, surgical guides, and precise bone cuts for prosthetic component placement',
                'completed total knee replacement showing titanium alloy femoral component, polyethylene tibial insert, and patellar button properly positioned within the knee joint. Display smooth articulating surfaces, proper alignment, and secure bone-prosthetic interface with cement or press-fit fixation'
            ],
            'heart-surgery': [
                'detailed cardiac anatomy showing coronary circulation with the right coronary artery (RCA), left anterior descending artery (LAD), and left circumflex artery (LCX). Highlight atherosclerotic plaque causing stenosis in coronary vessels, reduced myocardial perfusion, and areas of potential ischemia',
                'coronary artery bypass grafting (CABG) procedure in progress showing saphenous vein graft and internal mammary artery being anastomosed to coronary arteries distal to occlusions. Display surgical field with cardiopulmonary bypass, arrested heart, and precise vascular suturing techniques',
                'completed cardiac revascularization showing patent bypass grafts restoring blood flow to previously ischemic myocardium. Display improved coronary perfusion through saphenous vein grafts and arterial conduits, with enhanced myocardial viability and function'
            ],
            'cataract-surgery': [
                'ophthalmologic cross-section of the eye showing mature cataractous lens with cortical opacification, nuclear sclerosis, and reduced light transmission to the retina. Display anatomy including cornea, iris, ciliary body, vitreous chamber, and the clouded crystalline lens causing visual impairment',
                'phacoemulsification cataract surgery showing ultrasonic probe fragmenting the cataractous lens nucleus while irrigating and aspirating lens material through a 2.8mm clear corneal incision. Display surgical technique with capsulorhexis, hydrodissection, and lens cortex removal',
                'completed cataract surgery with foldable intraocular lens (IOL) implanted in the capsular bag. Show clear optical pathway through the artificial lens, restored light transmission to the retina, and proper IOL positioning for optimal visual acuity'
            ],
            'appendectomy': [
                'abdominal anatomy showing inflamed vermiform appendix attached to the cecum with signs of acute appendicitis including mucosal edema, serosal inflammation, and periappendiceal fat stranding. Display the ileocecal valve, terminal ileum, and surrounding peritoneal cavity',
                'laparoscopic appendectomy procedure showing trocar placement, pneumoperitoneum, and surgical dissection of the mesoappendix. Display endoscopic view with harmonic scalpel dividing appendicular artery, application of endoclips, and safe dissection plane near the cecal base',
                'post-appendectomy healing showing surgically removed appendix site with healthy cecal wall closure, resolved inflammation, and normal peritoneal healing. Display restored abdominal anatomy with healed trocar sites and no signs of complications'
            ],
            'dental-implant': [
                'oral anatomy cross-section showing edentulous alveolar ridge with bone resorption, reduced ridge height and width, and adjacent natural teeth with periodontal ligament and lamina dura. Display maxillary or mandibular bone structure requiring dental rehabilitation',
                'dental implant placement surgery showing titanium implant being inserted into prepared osteotomy site with precise depth and angulation. Display surgical drill sequence, implant threads engaging cortical and cancellous bone, and primary stability achievement',
                'completed dental implant restoration showing osseointegrated titanium implant with abutment and porcelain crown. Display healthy peri-implant tissues, restored occlusion, and proper emergence profile matching adjacent natural teeth'
            ],
            'gallbladder-surgery': [
                'hepatobiliary anatomy showing gallbladder with cholelithiasis (gallstones), thickened gallbladder wall, and bile duct system including common hepatic duct, cystic duct, and common bile duct. Display Calot\'s triangle anatomy with cystic artery and potential inflammation',
                'laparoscopic cholecystectomy showing four-port technique with pneumoperitoneum, grasping and retracting gallbladder fundus, and careful dissection of Calot\'s triangle. Display critical view of safety with clear identification of cystic artery and cystic duct before clipping',
                'post-cholecystectomy anatomy showing surgically removed gallbladder with preserved common bile duct patency, healed liver bed, and normal bile flow from hepatic ducts to duodenum. Display restored biliary anatomy without complications'
            ],
            'hip-replacement': [
                'hip joint anatomy showing degenerative osteoarthritis with femoral head osteophytes, acetabular cartilage loss, joint space narrowing, and subchondral sclerosis. Display deteriorated hip joint with bone-on-bone contact and surrounding muscle anatomy',
                'total hip arthroplasty procedure showing femoral head and neck resection, acetabular reaming, and preparation for prosthetic component insertion. Display surgical approach through hip capsule, precise bone preparation, and trial component placement',
                'completed total hip replacement showing titanium acetabular cup with polyethylene liner and modular femoral stem with ceramic or metal femoral head. Display proper component positioning, restored hip biomechanics, and stable bone-prosthetic interface'
            ]
        };
        return descriptions[procedure] || [];
    }

    getGenericStepDescription(stepIndex, totalSteps, type) {
        const percentage = (stepIndex / (totalSteps - 1)) * 100;
        
        if (type === 'educational') {
            if (percentage < 25) return 'Pre-procedure anatomy';
            if (percentage < 50) return 'Early surgical stage';
            if (percentage < 75) return 'Advanced surgical stage';
            return 'Post-procedure result';
        } else {
            if (percentage < 25) return 'Current condition analysis';
            if (percentage < 50) return 'Treatment planning';
            if (percentage < 75) return 'Treatment process';
            return 'Expected recovery';
        }
    }

    showLoading() {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('results').style.display = 'none';
        document.getElementById('generate-btn').disabled = true;
        this.updateProgressWithStatus(0, 'Preparing visualizations...');
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('generate-btn').disabled = false;
    }

    updateProgress(percentage) {
        document.getElementById('progress').style.width = `${percentage}%`;
    }

    updateProgressWithStatus(percentage, statusMessage) {
        document.getElementById('progress').style.width = `${percentage}%`;
        const statusElement = document.getElementById('loading-status');
        if (statusElement) {
            statusElement.textContent = statusMessage;
        }
    }

    displayResults(images) {
        const resultsDiv = document.getElementById('results');
        const sequenceDiv = document.getElementById('image-sequence');
        
        sequenceDiv.innerHTML = '';

        // Pre-fetch all anatomical descriptions for better tooltip performance
        this.preFetchAnatomicalDescriptions(images);

        images.forEach((imageData, index) => {
            const stepDiv = document.createElement('div');
            stepDiv.className = 'visualization-step';

            const title = document.createElement('h4');
            title.textContent = `Step ${imageData.step}: ${imageData.description}`;

            const img = document.createElement('img');
            img.src = `data:image/png;base64,${imageData.data}`;
            img.alt = imageData.description;
            img.loading = 'lazy';
            img.style.maxWidth = '100%';
            img.style.height = 'auto';

            const description = document.createElement('div');
            description.className = 'step-description';
            description.innerHTML = '<span class="description-loading">🔄 Generating detailed explanation...</span>';
            
            // Generate dynamic description for this specific visualization
            this.getOrGenerateImageDescription(imageData, index, images.length)
                .then(desc => {
                    console.log(`Description generated for ${this.currentMode} mode, step ${index + 1}:`, desc);
                    description.innerHTML = '';
                    description.textContent = desc;
                })
                .catch(error => {
                    console.warn(`Error generating description for ${this.currentMode} mode:`, error);
                    description.innerHTML = '';
                    const fallbackDesc = this.getDetailedStepDescription(index, images.length);
                    console.log(`Using fallback description for ${this.currentMode} mode:`, fallbackDesc);
                    description.textContent = fallbackDesc;
                });

            stepDiv.appendChild(title);
            stepDiv.appendChild(img);
            stepDiv.appendChild(description);
            
            // Add label information if available
            if (imageData.labels && imageData.labels.length > 0) {
                const labelInfo = document.createElement('div');
                labelInfo.className = 'label-info';
                
                const labelHeader = document.createElement('strong');
                labelHeader.textContent = 'Key structures labeled:';
                labelInfo.appendChild(labelHeader);
                
                const labelsContainer = document.createElement('div');
                labelsContainer.style.marginTop = '8px';
                
                imageData.labels.forEach((label, index) => {
                    const termElement = document.createElement('span');
                    termElement.className = 'anatomical-term';
                    termElement.textContent = label.text;
                    termElement.dataset.structure = label.text;
                    termElement.dataset.context = this.getStructureContext(imageData);
                    
                    // Add hover events for tooltip
                    this.addTooltipEvents(termElement);
                    
                    labelsContainer.appendChild(termElement);
                    
                    // Add comma separator except for last item
                    if (index < imageData.labels.length - 1) {
                        const separator = document.createElement('span');
                        separator.textContent = ' ';
                        labelsContainer.appendChild(separator);
                    }
                });
                
                labelInfo.appendChild(labelsContainer);
                stepDiv.appendChild(labelInfo);
            }
            
            sequenceDiv.appendChild(stepDiv);
        });

        resultsDiv.style.display = 'block';
        resultsDiv.scrollIntoView({ behavior: 'smooth' });
        
        // Set up image click handlers for popup functionality
        setTimeout(() => {
            this.setupImageClickHandlers();
        }, 100); // Small delay to ensure DOM is ready
    }

    // Pre-fetch anatomical descriptions for all structures in images
    async preFetchAnatomicalDescriptions(images) {
        try {
            // Collect all unique anatomical structures from all images
            const allStructures = new Set();
            const contextInfo = [];
            
            images.forEach(imageData => {
                if (imageData.labels && imageData.labels.length > 0) {
                    const context = this.getStructureContext(imageData);
                    imageData.labels.forEach(label => {
                        allStructures.add(label.text);
                        contextInfo.push({ structure: label.text, context });
                    });
                }
            });

            if (allStructures.size === 0) {
                console.log('No anatomical structures found for pre-fetching');
                return;
            }

            console.log(`Pre-fetching descriptions for ${allStructures.size} anatomical structures...`);

            // Create a single prompt for all structures
            const structuresList = Array.from(allStructures);
            const prompt = this.createBatchAnatomicalDescriptionPrompt(structuresList, contextInfo);

            // Make a single API call for all descriptions
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.getApiKey()}`;
            
            const requestBody = {
                contents: [{
                    parts: [{ text: prompt }]
                }]
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                console.warn(`Batch description pre-fetch failed: ${response.status}`);
                return;
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                const responseText = data.candidates[0].content.parts[0].text;
                const parsedDescriptions = this.parseBatchAnatomicalDescriptions(responseText, structuresList);
                
                // Store in both caches for compatibility
                structuresList.forEach(structure => {
                    const description = parsedDescriptions[structure];
                    if (description) {
                        // Store in pre-fetched cache
                        this.preFetchedDescriptions.set(structure, description);
                        
                        // Store in traditional cache with context keys
                        contextInfo.filter(item => item.structure === structure).forEach(item => {
                            const cacheKey = `${item.structure}-${item.context}`;
                            this.anatomicalDescriptions.set(cacheKey, description);
                        });
                    }
                });

                console.log(`Successfully pre-fetched descriptions for ${Object.keys(parsedDescriptions).length} structures`);
            }
        } catch (error) {
            console.warn('Error pre-fetching anatomical descriptions:', error);
        }
    }

    createBatchAnatomicalDescriptionPrompt(structures, contextInfo) {
        const contextMap = new Map();
        contextInfo.forEach(item => {
            if (!contextMap.has(item.structure)) {
                contextMap.set(item.structure, item.context);
            }
        });

        const prompt = `You are a medical educator creating patient-friendly explanations. Provide information about the following anatomical structures. 

For each structure, provide exactly 3 sections in this format:

STRUCTURE_NAME:
MEDICAL: [Precise medical description using proper anatomical terminology (1-2 sentences)]
SIMPLE: [Simple explanation that anyone can understand, avoiding medical jargon (1-2 sentences)]
FUNCTION: [What this structure does and why it's important for the body (1-2 sentences)]

Example:
INTERNAL_JUGULAR_VEIN:
MEDICAL: The internal jugular vein is a large venous vessel that drains deoxygenated blood from the brain, face, and neck back to the heart via the superior vena cava.
SIMPLE: This is a major blood vessel in your neck that carries used blood from your brain and head back to your heart for fresh oxygen.
FUNCTION: It ensures proper blood circulation from your brain and prevents harmful buildup of waste products in your head and neck area.

Please provide descriptions for these structures:

${structures.map(structure => {
    const context = contextMap.get(structure) || 'medical anatomy';
    return `${structure.toUpperCase().replace(/\s+/g, '_')}: (Context: ${context})`;
}).join('\n')}

Provide complete information for ALL structures listed above.`;

        return prompt;
    }

    parseBatchAnatomicalDescriptions(responseText, structures) {
        const descriptions = {};
        
        try {
            const lines = responseText.split('\n');
            let currentStructure = null;
            let currentSection = null;
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                
                // Check if this line starts a new structure
                const structureMatch = structures.find(structure => 
                    trimmedLine.startsWith(structure.toUpperCase().replace(/\s+/g, '_') + ':')
                );
                
                if (structureMatch) {
                    currentStructure = structureMatch;
                    descriptions[currentStructure] = {
                        medical: '',
                        simple: '',
                        function: ''
                    };
                    continue;
                }
                
                if (!currentStructure) continue;
                
                // Check for section headers
                if (trimmedLine.startsWith('MEDICAL:')) {
                    currentSection = 'medical';
                    descriptions[currentStructure].medical = trimmedLine.replace('MEDICAL:', '').trim();
                } else if (trimmedLine.startsWith('SIMPLE:')) {
                    currentSection = 'simple';
                    descriptions[currentStructure].simple = trimmedLine.replace('SIMPLE:', '').trim();
                } else if (trimmedLine.startsWith('FUNCTION:')) {
                    currentSection = 'function';
                    descriptions[currentStructure].function = trimmedLine.replace('FUNCTION:', '').trim();
                } else if (trimmedLine && currentSection && currentStructure) {
                    // Continue previous section if line doesn't start with a section header
                    descriptions[currentStructure][currentSection] += ' ' + trimmedLine;
                }
            }
            
            // Ensure all descriptions have valid content
            structures.forEach(structure => {
                if (descriptions[structure]) {
                    if (!descriptions[structure].medical) {
                        descriptions[structure].medical = `${structure} is an anatomical structure relevant to this medical context.`;
                    }
                    if (!descriptions[structure].simple) {
                        descriptions[structure].simple = `This is a part of your body that plays a role in this medical procedure or condition.`;
                    }
                    if (!descriptions[structure].function) {
                        descriptions[structure].function = `This structure contributes to the normal functioning of your body in this area.`;
                    }
                }
            });
            
        } catch (error) {
            console.warn('Error parsing batch anatomical descriptions:', error);
        }
        
        return descriptions;
    }

    getDetailedStepDescription(stepIndex, totalSteps) {
        if (this.currentMode === 'learn') {
            const procedure = this.selectedProcedure;
            const detailedDescriptions = {
                'knee-replacement': [
                    'This shows your natural knee joint with cartilage, bone, and ligaments. You can see how the cartilage may be worn down, causing pain and stiffness.',
                    'The surgeon carefully removes damaged cartilage and bone, preparing the surface for the artificial components. Precise measurements ensure proper fit.',
                    'Your new artificial knee joint is in place, made of metal and plastic components that will allow smooth, pain-free movement for many years.'
                ],
                'heart-surgery': [
                    'Your heart showing the coronary arteries that supply blood to the heart muscle. Blocked arteries can cause chest pain and heart attacks.',
                    'The surgeon creates new pathways (bypasses) around blocked arteries using blood vessels from other parts of your body.',
                    'Blood flow is now restored to all areas of your heart through the new bypass grafts, improving heart function and reducing symptoms.'
                ],
                'cataract-surgery': [
                    'Your eye showing the cloudy lens (cataract) that blocks light from reaching the retina, causing blurry vision.',
                    'Using ultrasound, the surgeon gently breaks up and removes the cloudy lens through a tiny incision.',
                    'A clear, artificial lens is implanted to restore sharp vision. Most patients notice immediate improvement in their sight.'
                ]
            };

            if (detailedDescriptions[procedure] && detailedDescriptions[procedure][stepIndex]) {
                return detailedDescriptions[procedure][stepIndex];
            }
        } else if (this.currentMode === 'personal') {
            // Better fallback descriptions for personal medical imaging mode
            const personalQuery = document.getElementById('personal-query')?.value || '';
            const stepDescriptions = this.getPersonalStepDescriptions(stepIndex, totalSteps, personalQuery);
            return stepDescriptions;
        }

        return 'This visualization helps you understand your medical situation and what to expect during your care.';
    }

    getPersonalStepDescriptions(stepIndex, totalSteps, query) {
        // Create more specific fallback descriptions based on step and query content
        const stepPhase = ((stepIndex) / Math.max(1, totalSteps - 1)) * 100;
        
        if (totalSteps === 1) {
            return `This visualization shows your current medical condition based on your uploaded images. The detailed view helps explain what you're experiencing and provides context for your treatment options.`;
        }
        
        if (stepPhase <= 33) {
            return `This first visualization shows your current medical condition as it appears in your uploaded images. You can see the anatomical structures and how your specific condition affects this area of your body.`;
        } else if (stepPhase <= 66) {
            return `This visualization demonstrates the treatment process for your condition. You can see how medical intervention addresses the issues identified in your initial images and what changes to expect.`;
        } else {
            return `This final visualization shows the expected outcome after treatment. You can see how your condition should improve and what the healing process typically looks like for cases similar to yours.`;
        }
    }

    async getOrGenerateImageDescription(imageData, stepIndex, totalSteps) {
        // First try to use existing analysis description
        if (imageData.analysis && imageData.analysis.description) {
            return imageData.analysis.description;
        }

        // Check if we have a cached description
        let cacheKey;
        if (this.currentMode === 'learn') {
            cacheKey = `desc-learn-${this.selectedProcedure || 'custom'}-${stepIndex}-${totalSteps}`;
        } else {
            // For personal mode, use a hash of the query to create unique keys
            const personalQuery = document.getElementById('personal-query')?.value || 'medical-condition';
            const queryHash = personalQuery.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_');
            cacheKey = `desc-personal-${queryHash}-${stepIndex}-${totalSteps}`;
        }
        if (this.imageDescriptions.has(cacheKey)) {
            return this.imageDescriptions.get(cacheKey);
        }

        try {
            // Generate new description using Gemini API
            console.log(`Generating ${this.currentMode} description for step ${stepIndex + 1} of ${totalSteps}`);
            const description = await this.generateImageSpecificDescription(imageData, stepIndex, totalSteps);
            
            // Cache the result
            this.imageDescriptions.set(cacheKey, description);
            
            console.log(`Successfully generated ${this.currentMode} description:`, description.substring(0, 100) + '...');
            return description;
        } catch (error) {
            console.warn(`Failed to generate ${this.currentMode} image description:`, error);
            console.log(`Falling back to predefined description for ${this.currentMode} mode`);
            // Fall back to predefined description
            return this.getDetailedStepDescription(stepIndex, totalSteps);
        }
    }

    async generateImageSpecificDescription(imageData, stepIndex, totalSteps) {
        // Build context for the AI
        let procedureContext = '';
        let stepContext = `Step ${stepIndex + 1} of ${totalSteps}`;
        
        if (this.currentMode === 'learn') {
            if (this.selectedProcedure && this.selectedProcedure !== 'custom') {
                procedureContext = this.getPredefinedProcedurePrompt(this.selectedProcedure);
            } else {
                procedureContext = document.getElementById('procedure-description')?.value || 'medical procedure';
            }
        } else {
            procedureContext = document.getElementById('personal-query')?.value || 'medical condition';
        }

        // Get labeled structures for context
        const labeledStructures = imageData.labels ? 
            imageData.labels.map(label => label.text).join(', ') : 
            'various anatomical structures';

        // Build more specific context based on mode
        let promptContext = '';
        let modeSpecificInstructions = '';
        
        if (this.currentMode === 'learn') {
            promptContext = `Educational visualization about: ${procedureContext}`;
            modeSpecificInstructions = `
- Focus on explaining the medical procedure step by step
- Help patients understand what happens during this specific stage
- Relate to the overall surgical or medical process`;
        } else {
            promptContext = `Personal medical consultation about: ${procedureContext}`;
            modeSpecificInstructions = `
- Focus on explaining the patient's specific condition shown in their images
- Help them understand what they're seeing in their own medical situation
- Provide reassurance and context for their treatment journey
- Reference their uploaded medical images when relevant`;
        }

        const prompt = `You are a medical educator explaining a medical visualization to patients. Create a clear, informative description for this specific visualization.

Context:
- ${promptContext}
- ${stepContext}
- Labeled structures visible: ${labeledStructures}
- Total sequence: This is part of a ${totalSteps}-step visualization sequence

MODE-SPECIFIC FOCUS:${modeSpecificInstructions}

CRITICAL FORMATTING REQUIREMENTS:
- Write in plain text only - NO markdown formatting
- NO asterisks (*), NO bold (**), NO special symbols for emphasis
- Use parentheses for simple explanations instead of bold/italic
- Example: "vertebrae (the bones of your spine)" instead of "**vertebrae**"

CONTENT REQUIREMENTS:
1. Write 2-3 sentences describing what is specifically shown in this visualization
2. Use medical terms followed immediately by simple explanations in parentheses
3. Focus on what the patient can see and understand from this specific image
4. Explain what is happening at this particular step of the ${this.currentMode === 'learn' ? 'procedure' : 'condition/treatment'}
5. Make it specific to THIS step, not generic information
6. Write in a warm, educational tone that reduces patient anxiety

MEDICAL EXPLANATION FORMAT:
- Always follow medical terms with simple explanations: "lumbar vertebrae (the bones in your lower back)"
- Use "called" or parentheses for clarification: "intervertebral discs (the cushions between your spine bones)"
- Avoid intimidating language, use reassuring explanations

${this.currentMode === 'learn' ? 
    'Example formats for educational mode:\n- "This image shows your spine anatomy before the procedure begins. You can see your lumbar vertebrae (the bones in your lower back) and the intervertebral discs (soft cushions between the bones) that provide flexibility."\n- "At this stage, the surgeon is carefully placing the fusion hardware. You can see the metal screws and rods (called spinal instrumentation) that will help your bones grow together permanently."' :
    'Example formats for personal consultation mode:\n- "This visualization shows your current condition as seen in your uploaded images. You can see how the affected area appears and what anatomical structures are involved in your specific case."\n- "This visualization demonstrates how your treatment will address the issues visible in your medical images. You can see the expected changes and improvements in your specific condition."'
}

Generate a specific, step-focused description in plain text for this ${stepContext.toLowerCase()} visualization of ${procedureContext}:`;

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.getApiKey()}`;
            
            const requestBody = {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 300
                }
            };

            // Add timeout to prevent hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API request failed with status ${response.status}:`, errorText);
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                let description = data.candidates[0].content.parts[0].text.trim();
                
                // Comprehensive cleanup of markdown and formatting artifacts
                description = description.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
                description = description.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove **bold** formatting
                description = description.replace(/\*(.*?)\*/g, '$1'); // Remove *italic* formatting
                description = description.replace(/__(.*?)__/g, '$1'); // Remove __underline__ formatting
                description = description.replace(/_(.*?)_/g, '$1'); // Remove _italic_ formatting
                description = description.replace(/\n+/g, ' '); // Replace newlines with spaces
                description = description.replace(/\s+/g, ' '); // Normalize multiple spaces
                description = description.trim();
                
                if (!description) {
                    throw new Error('Generated description is empty after cleanup');
                }
                
                return description;
            }
            
            console.error('API response structure:', JSON.stringify(data, null, 2));
            throw new Error('No valid response from API - unexpected response structure');
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('API request timeout for image description generation');
                throw new Error('Request timeout - description generation took too long');
            }
            console.error('Error generating image description:', error);
            throw error;
        }
    }

    clearDescriptionCaches() {
        // Clear caches for new generation to ensure fresh descriptions
        this.imageDescriptions.clear();
        this.enhancedPrompts.clear();
        this.imageAnalysisCache.clear();
        console.log('Description and enhancement caches cleared for fresh generation');
    }

    // Tooltip System Methods
    
    initializeTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tooltip';
        
        // Allow tooltip to be hovered
        this.tooltip.addEventListener('mouseenter', () => {
            // Keep tooltip visible when hovering over it
        });
        
        this.tooltip.addEventListener('mouseleave', () => {
            this.hideTooltip();
        });
        
        document.body.appendChild(this.tooltip);
    }

    getStructureContext(imageData) {
        // Provide context about the medical procedure or body system
        if (this.currentMode === 'learn') {
            if (this.selectedProcedure && this.selectedProcedure !== 'custom') {
                return this.selectedProcedure;
            }
        }
        return imageData.description || 'medical anatomy';
    }

    addTooltipEvents(element) {
        let hoverTimeout;
        let isHovering = false;
        let lastMouseEvent = null;
        
        element.addEventListener('mouseenter', (e) => {
            isHovering = true;
            lastMouseEvent = e;
            clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => {
                if (isHovering) { // Only show if still hovering
                    this.showTooltip(e.target, lastMouseEvent);
                }
            }, 150); // Much quicker popup - reduced from 300ms to 150ms
        });

        element.addEventListener('mouseleave', () => {
            isHovering = false;
            clearTimeout(hoverTimeout);
            // Delay hiding to allow moving to tooltip
            setTimeout(() => {
                if (!this.tooltip?.matches(':hover') && !element.matches(':hover')) {
                    this.hideTooltip();
                }
            }, 100);
        });

        element.addEventListener('mousemove', (e) => {
            lastMouseEvent = e;
            if (this.tooltip?.classList.contains('show')) {
                this.positionTooltip(e);
            }
        });
    }

    async showTooltip(element, mouseEvent = null) {
        const structure = element.dataset.structure;
        const context = element.dataset.context;
        
        // Hide tooltip first to prevent jump from previous position
        this.tooltip.classList.remove('show');
        
        // Reset tooltip content to prepare for new content
        this.tooltip.innerHTML = '';
        
        // Position tooltip immediately based on mouse position or element position
        if (mouseEvent) {
            this.positionTooltip(mouseEvent);
        } else {
            const rect = element.getBoundingClientRect();
            this.positionTooltip({ 
                clientX: rect.left + rect.width / 2, 
                clientY: rect.top 
            });
        }
        
        // Check pre-fetched descriptions first
        if (this.preFetchedDescriptions.has(structure)) {
            this.displayTooltipContent(structure, this.preFetchedDescriptions.get(structure));
            this.tooltip.classList.add('show');
            // Re-position after content is loaded
            if (mouseEvent) {
                this.positionTooltip(mouseEvent);
            }
            return;
        }

        // Check traditional cache
        const cacheKey = `${structure}-${context}`;
        if (this.anatomicalDescriptions.has(cacheKey)) {
            this.displayTooltipContent(structure, this.anatomicalDescriptions.get(cacheKey));
            this.tooltip.classList.add('show');
            // Re-position after content is loaded
            if (mouseEvent) {
                this.positionTooltip(mouseEvent);
            }
            return;
        }

        // Show loading state only if we need to fetch
        this.tooltip.innerHTML = `
            <div class="tooltip-loading">
                <div class="tooltip-spinner"></div>
                Loading description...
            </div>
        `;
        this.tooltip.classList.add('show');
        
        // Re-position after loading content is set
        if (mouseEvent) {
            this.positionTooltip(mouseEvent);
        }

        try {
            // Generate description using Gemini API (fallback)
            const description = await this.generateAnatomicalDescription(structure, context);
            
            // Cache the result
            this.anatomicalDescriptions.set(cacheKey, description);
            this.preFetchedDescriptions.set(structure, description);
            
            // Display content if tooltip is still visible
            if (this.tooltip.classList.contains('show')) {
                this.displayTooltipContent(structure, description);
                // Re-position after content update
                if (mouseEvent) {
                    this.positionTooltip(mouseEvent);
                }
            }
        } catch (error) {
            console.warn('Error generating description for', structure, error);
            
            // Show error state
            if (this.tooltip.classList.contains('show')) {
                this.tooltip.innerHTML = `
                    <div class="tooltip-header">
                        <div class="tooltip-icon">⚕️</div>
                        <div class="tooltip-title">${structure}</div>
                    </div>
                    <div class="tooltip-section">
                        <div class="tooltip-text">Description temporarily unavailable. Please try again later.</div>
                    </div>
                `;
                // Re-position after error content is set
                if (mouseEvent) {
                    this.positionTooltip(mouseEvent);
                }
            }
        }
    }

    displayTooltipContent(structure, description) {
        this.tooltip.innerHTML = `
            <div class="tooltip-header">
                <div class="tooltip-icon">⚕️</div>
                <div class="tooltip-title">${structure}</div>
            </div>
            <div class="tooltip-section">
                <div class="tooltip-label">Medical Description</div>
                <div class="tooltip-text">${description.medical}</div>
            </div>
            <div class="tooltip-section">
                <div class="tooltip-label">Simple Explanation</div>
                <div class="tooltip-text">${description.simple}</div>
            </div>
            <div class="tooltip-section">
                <div class="tooltip-label">Function</div>
                <div class="tooltip-text">${description.function}</div>
            </div>
        `;
    }

    async generateAnatomicalDescription(structure, context) {
        const prompt = `You are a medical educator creating patient-friendly explanations. Provide information about the anatomical structure "${structure}" in the context of "${context}".

CRITICAL FORMATTING REQUIREMENTS:
- Write in plain text only - NO markdown formatting
- NO asterisks (*), NO bold (**), NO special symbols for emphasis
- Use simple parentheses for explanations instead of formatting
- Example: "jugular vein (a large blood vessel)" instead of "**jugular vein**"

Provide exactly 3 sections:

MEDICAL: A precise medical description using proper anatomical terminology (1-2 sentences)
SIMPLE: A simple explanation that anyone can understand, avoiding medical jargon (1-2 sentences)  
FUNCTION: What this structure does and why it's important for the body (1-2 sentences)

Example format:
MEDICAL: The internal jugular vein is a large venous vessel that drains deoxygenated blood from the brain, face, and neck back to the heart via the superior vena cava.
SIMPLE: This is a major blood vessel in your neck that carries used blood from your brain and head back to your heart for fresh oxygen.
FUNCTION: It ensures proper blood circulation from your brain and prevents harmful buildup of waste products in your head and neck area.

Structure: ${structure}
Context: ${context}`;

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.getApiKey()}`;
            
            const requestBody = {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.6,
                    maxOutputTokens: 400
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                const responseText = data.candidates[0].content.parts[0].text;
                return this.parseAnatomicalDescription(responseText);
            }
            
            throw new Error('No valid response from API');
        } catch (error) {
            console.error('Error generating anatomical description:', error);
            // Fallback description
            return {
                medical: `${structure} is an anatomical structure relevant to this medical context.`,
                simple: `This is a part of your body that plays a role in this medical procedure or condition.`,
                function: `This structure contributes to the normal functioning of your body in this area.`
            };
        }
    }

    parseAnatomicalDescription(responseText) {
        try {
            const lines = responseText.split('\n');
            const description = {
                medical: '',
                simple: '',
                function: ''
            };

            let currentSection = '';
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                
                if (trimmedLine.startsWith('MEDICAL:')) {
                    currentSection = 'medical';
                    description.medical = trimmedLine.replace('MEDICAL:', '').trim();
                } else if (trimmedLine.startsWith('SIMPLE:')) {
                    currentSection = 'simple';
                    description.simple = trimmedLine.replace('SIMPLE:', '').trim();
                } else if (trimmedLine.startsWith('FUNCTION:')) {
                    currentSection = 'function';
                    description.function = trimmedLine.replace('FUNCTION:', '').trim();
                } else if (trimmedLine && currentSection) {
                    // Continue previous section if line doesn't start with a section header
                    description[currentSection] += ' ' + trimmedLine;
                }
            }

            // Ensure all sections have content and clean up formatting
            const cleanText = (text) => {
                if (!text) return 'Description not available.';
                // Remove markdown formatting
                return text
                    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **bold**
                    .replace(/\*(.*?)\*/g, '$1') // Remove *italic*
                    .replace(/__(.*?)__/g, '$1') // Remove __underline__
                    .replace(/_(.*?)_/g, '$1') // Remove _italic_
                    .replace(/\s+/g, ' ') // Normalize spaces
                    .trim();
            };

            description.medical = cleanText(description.medical) || 'Medical description not available.';
            description.simple = cleanText(description.simple) || 'Simple explanation not available.';
            description.function = cleanText(description.function) || 'Function description not available.';

            return description;
        } catch (error) {
            console.warn('Error parsing description:', error);
            return {
                medical: 'Medical description parsing failed.',
                simple: 'Simple explanation parsing failed.',
                function: 'Function description parsing failed.'
            };
        }
    }

    positionTooltip(event) {
        if (!this.tooltip) return;
        
        // Store mouse position for arrow calculation
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        
        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Set initial position to measure tooltip dimensions
        this.tooltip.style.left = '0px';
        this.tooltip.style.top = '0px';
        this.tooltip.style.visibility = 'hidden';
        this.tooltip.style.display = 'block';
        
        // Get tooltip dimensions after content is set
        const tooltipRect = this.tooltip.getBoundingClientRect();
        
        let x = mouseX + 15;
        let y = mouseY - 10;
        
        // Adjust horizontal position if tooltip would go off-screen
        if (x + tooltipRect.width > viewportWidth - 20) {
            x = mouseX - tooltipRect.width - 15;
        }
        
        // Adjust vertical position if tooltip would go off-screen
        if (y + tooltipRect.height > viewportHeight - 20) {
            y = mouseY - tooltipRect.height - 10;
        }
        
        // Ensure tooltip stays within viewport
        x = Math.max(10, Math.min(x, viewportWidth - tooltipRect.width - 10));
        y = Math.max(10, Math.min(y, viewportHeight - tooltipRect.height - 10));
        
        // Update arrow position based on mouse position relative to tooltip
        // this.updateTooltipArrow(mouseX, x, tooltipRect.width); // Removed arrow positioning
        
        // Apply final position
        this.tooltip.style.left = x + 'px';
        this.tooltip.style.top = y + 'px';
        this.tooltip.style.visibility = 'visible';
    }

    updateTooltipArrow(mouseX, tooltipX, tooltipWidth) {
        // Arrow functionality removed - keeping method for compatibility
        return;
    }

    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.classList.remove('show');
            // Reset display and visibility to prevent flashing
            setTimeout(() => {
                if (!this.tooltip.classList.contains('show')) {
                    this.tooltip.style.display = 'none';
                    this.tooltip.style.visibility = 'hidden';
                }
            }, 50); // Small delay to allow animation to complete
        }
    }

    // Image Popup System Methods
    
    initializeImagePopup() {
        // Create popup overlay
        this.imagePopup = document.createElement('div');
        this.imagePopup.className = 'image-popup-overlay';
        
        this.imagePopup.innerHTML = `
            <div class="image-popup-container">
                <button class="image-popup-close" title="Close">×</button>
                <img src="" alt="Full size medical visualization">
                <div class="image-popup-info"></div>
            </div>
        `;
        
        document.body.appendChild(this.imagePopup);
        
        // Add event listeners
        this.imagePopup.addEventListener('click', (e) => {
            if (e.target === this.imagePopup) {
                this.closeImagePopup();
            }
        });
        
        this.imagePopup.querySelector('.image-popup-close').addEventListener('click', () => {
            this.closeImagePopup();
        });
        
        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.imagePopup.classList.contains('show')) {
                this.closeImagePopup();
            }
        });
    }
    
    setupImageClickHandlers() {
        // Add click handlers to all visualization step images
        document.querySelectorAll('.visualization-step img').forEach(img => {
            img.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openImagePopup(img);
            });
        });
    }
    
    openImagePopup(imgElement) {
        if (!this.imagePopup) return;
        
        const popupImg = this.imagePopup.querySelector('img');
        const popupInfo = this.imagePopup.querySelector('.image-popup-info');
        
        // Set image source
        popupImg.src = imgElement.src;
        popupImg.alt = imgElement.alt || 'Medical visualization';
        
        // Find the parent visualization step for context
        const stepElement = imgElement.closest('.visualization-step');
        let infoText = '';
        
        if (stepElement) {
            const title = stepElement.querySelector('h4')?.textContent || '';
            const description = stepElement.querySelector('.step-description')?.textContent || '';
            
            if (title) {
                infoText = title;
                if (description) {
                    infoText += ' - Click image to close or press ESC';
                } else {
                    infoText += ' - Click image to close or press ESC';
                }
            } else {
                infoText = 'Medical Visualization - Click image to close or press ESC';
            }
        } else {
            infoText = 'Medical Visualization - Click image to close or press ESC';
        }
        
        popupInfo.textContent = infoText;
        
        // Show popup
        this.imagePopup.classList.add('show');
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }
    
    closeImagePopup() {
        if (!this.imagePopup) return;
        
        this.imagePopup.classList.remove('show');
        
        // Restore body scroll
        document.body.style.overflow = '';
        
        // Clear image source after animation
        setTimeout(() => {
            if (!this.imagePopup.classList.contains('show')) {
                const popupImg = this.imagePopup.querySelector('img');
                popupImg.src = '';
            }
        }, 300);
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MedicalVisualizationApp();
});
