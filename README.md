# Viscera - Medical Visualization for Patients

An AI-powered medical visualization tool that helps patients understand surgeries, diagnoses, and treatments using Google's Gemini 2.5 Flash Image Generation model.

## Problem Solved

Patients often don't understand their medical procedures, leading to:
- Increased anxiety and stress
- Poor treatment compliance
- Potential malpractice issues
- Communication barriers with healthcare providers

## Solution

Viscera provides personalized medical imagery and educational visualizations to help patients understand:
- "This is what your knee replacement will look like"
- "This is your lung with and without treatment"
- Step-by-step procedure explanations
- Personalized analysis of medical images

## Features

### 🏥 Two Operation Modes

1. **Learn About Procedures**: Educational visualizations for common medical procedures
2. **Personal Medical Imaging**: Upload your medical images for personalized explanations

### 📚 Pre-defined Procedures
- Knee Replacement Surgery
- Heart Surgery (Bypass)
- Cataract Surgery
- Appendectomy
- Dental Implant
- Gallbladder Surgery
- Hip Replacement
- Custom procedures (text input)

### 🖼️ Personal Medical Analysis
- Upload X-rays, MRIs, CT scans
- AI-powered analysis and explanation
- Personalized treatment visualization

### 🎯 Sequential Visualization
- Generate 1-7 step sequences
- Before, during, and after procedure views
- Progressive treatment explanations

## Technology Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (ES6+)
- **AI Model**: Google Gemini 2.5 Flash & Gemini 2.5 Flash Image Preview
- **API**: Direct REST API calls to Google GenAI
- **Styling**: Modern CSS with responsive design and mobile-first approach
- **Architecture**: Modular, component-based JavaScript with caching system
- **Development**: Node.js with serve for local development

## Installation & Setup

1. **Clone or Download the Project**
   ```bash
   cd viscera
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **API Key Setup**
   - Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Enter the key in the input field at the top of the app interface
   - *Note: API keys are only stored in memory and never saved*

4. **Start the Application**
   ```bash
   npm start
   ```
   Or for development:
   ```bash
   npm run dev
   ```

5. **Open in Browser**
   - Navigate to `http://localhost:3000`
   - The app will automatically serve with CORS enabled

## Usage

### Learn Mode
1. Select a predefined procedure or choose "Custom Procedure"
2. For custom procedures, describe what you want to learn about
3. Choose the number of visualization steps (1-7)
4. Click "Generate Medical Visualization"

### Personal Mode
1. Upload your medical images (drag & drop or click to select)
2. Describe what you want to understand about your condition
3. Choose the number of visualization steps
4. Click "Generate Medical Visualization"

### Privacy
- API key is only stored in local memory
- No user registration required
- No personal data storage
- Transparent AI processing

## Medical Disclaimer

⚠️ **Important**: These visualizations are for educational purposes only and should not replace professional medical advice. Always consult with your healthcare provider for medical decisions.

## License

MIT License - See LICENSE file for details
