// Import necessary libraries
import { GoogleGenerativeAI } from '@google/generative-ai';
import gsap from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

// Register GSAP plugins
gsap.registerPlugin(ScrollToPlugin);

// --- State Management ---
const API_KEY = (window as any).GEMINI_API_KEY;
let genAI: GoogleGenerativeAI;
let isLoading = false;
let activeBudget = 'medium';
let activeSpotPreference = 'Popular TouristSpots';
const activeInterests = new Set<string>();

// --- DOM Elements ---
const preloader = document.getElementById('preloader') as HTMLElement;
const header = document.querySelector('header') as HTMLElement;
const navLinks = document.querySelectorAll('.nav-link');
const logoLink = document.querySelector('.logo-link') as HTMLAnchorElement;
const homePage = document.getElementById('home-page') as HTMLElement;
const aboutPage = document.getElementById('about-page') as HTMLElement;
const setupGuide = document.getElementById('setup-guide') as HTMLElement;
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;
const themeIconSun = document.getElementById('theme-icon-sun') as HTMLElement;
const themeIconMoon = document.getElementById('theme-icon-moon') as HTMLElement;
const startPlanningBtn = document.getElementById('start-planning-btn') as HTMLButtonElement;
const mainContent = document.getElementById('main-content') as HTMLElement;
const plannerForm = document.getElementById('planner-form') as HTMLFormElement;
const destinationInput = document.getElementById('destination-input') as HTMLInputElement;
const durationInput = document.getElementById('duration-input') as HTMLInputElement;
const ageGroupSelect = document.getElementById('age-group-select') as HTMLSelectElement;
const vibeTextarea = document.getElementById('vibe-textarea') as HTMLTextAreaElement;
const budgetControl = document.getElementById('budget-control') as HTMLDivElement;
const spotPreferenceControl = document.getElementById('spot-preference-control') as HTMLDivElement;
const interestsGroup = document.getElementById('interests-group') as HTMLDivElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const resultSection = document.getElementById('result-section') as HTMLElement;

// --- Itinerary Schema ---
const itinerarySchema = {
    type: 'object',
    properties: {
        destinationName: { type: 'string' },
        tripTitle: { type: 'string' },
        summary: { type: 'string' },
        dailyPlans: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    day: { type: 'number' },
                    title: { type: 'string' },
                    activities: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    food: {
                        type: 'object',
                        properties: {
                            breakfast: { type: 'string' },
                            lunch: { type: 'string' },
                            dinner: { type: 'string' }
                        }
                    },
                    accommodation: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            type: { type: 'string' },
                            priceRange: { type: 'string' }
                        }
                    }
                },
                required: ['day', 'title', 'activities']
            }
        }
    },
    required: ['destinationName', 'tripTitle', 'summary', 'dailyPlans']
};

// --- Core App Logic ---
const showSetupGuide = () => {
    homePage.classList.add('hidden');
    aboutPage.classList.add('hidden');
    setupGuide.classList.remove('hidden');
};

const initializeApp = async () => {
    try {
        if (!API_KEY || API_KEY === 'PASTE_YOUR_API_KEY_HERE' || API_KEY === 'YOUR_API_KEY_HERE') {
            console.error('API Key not found or is placeholder');
            if (location.hash === '#about') {
                runMainApp();
                return;
            }
            showSetupGuide();
            return;
        }

        genAI = new GoogleGenerativeAI(API_KEY);
        runMainApp();
    } catch (error) {
        console.error('Initialization Error:', error);
        showSetupGuide();
    } finally {
        if (preloader) {
            preloader.style.display = 'none';
        }
    }
};

// --- UI Update Functions ---
const displayItinerary = (itinerary: any): void => {
    if (!resultSection) return;
    
    resultSection.innerHTML = '';
    
    const itineraryHTML = `
        <div class="itinerary-container">
            <h2>${itinerary.tripTitle || 'Your Travel Itinerary'}</h2>
            <p class="itinerary-summary">${itinerary.summary || ''}</p>
            
            ${itinerary.dailyPlans?.map((day: any) => `
                <div class="day-plan">
                    <h3>Day ${day.day}: ${day.title || ''}</h3>
                    
                    <div class="activities">
                        <h4>Activities:</h4>
                        <ul>
                            ${day.activities?.map((activity: string) => `
                                <li>${activity}</li>
                            `).join('') || '<li>No activities planned</li>'}
                        </ul>
                    </div>
                    
                    <div class="food">
                        <h4>Dining:</h4>
                        <p><strong>Breakfast:</strong> ${day.food?.breakfast || 'Not specified'}</p>
                        <p><strong>Lunch:</strong> ${day.food?.lunch || 'Not specified'}</p>
                        <p><strong>Dinner:</strong> ${day.food?.dinner || 'Not specified'}</p>
                    </div>
                    
                    ${day.accommodation?.name ? `
                        <div class="accommodation">
                            <h4>Accommodation:</h4>
                            <p><strong>${day.accommodation.name}</strong> (${day.accommodation.type || 'Not specified'})</p>
                        </div>
                    ` : ''}
                </div>
            `).join('') || '<p>No daily plans available.</p>'}
        </div>
    `;
    
    resultSection.innerHTML = itineraryHTML;
    resultSection.scrollIntoView({ behavior: 'smooth' });
};

const displayError = (message: string): void => {
    if (!resultSection) return;
    
    resultSection.innerHTML = `
        <div class="error-message">
            <p>${message}</p>
            <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
        </div>
    `;
    resultSection.scrollIntoView({ behavior: 'smooth' });
};

// --- Navigation ---
const navigateTo = (page: string) => {
    if (page === 'about') {
        window.location.hash = 'about';
    } else {
        window.location.hash = '';
    }
    setInitialPage(page);
};

const setInitialPage = (page: string) => {
    homePage?.classList.add('hidden');
    aboutPage?.classList.add('hidden');
    
    if (page === 'about') {
        aboutPage?.classList.remove('hidden');
    } else {
        homePage?.classList.remove('hidden');
    }
};

// --- Theme Management ---
const applyTheme = (theme: 'light' | 'dark') => {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    themeIconSun?.classList.toggle('hidden', theme === 'dark');
    themeIconMoon?.classList.toggle('hidden', theme !== 'dark');
    localStorage.setItem('theme', theme);
};

const initializeTheme = () => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
};

// --- Event Handlers ---
const handleThemeToggle = () => {
    const isDark = document.body.classList.contains('dark-mode');
    applyTheme(isDark ? 'light' : 'dark');
};

const setUILoading = (loading: boolean) => {
    isLoading = loading;
    if (generateBtn) {
        generateBtn.disabled = loading;
        generateBtn.innerHTML = loading 
            ? '<span class="loading-spinner"></span> Generating...' 
            : 'Generate Itinerary';
    }
};

const handleFormSubmit = async (event: Event) => {
    event.preventDefault();
    if (isLoading || !genAI) return;
    
    try {
        setUILoading(true);
        const navbarHeight = header?.offsetHeight || 0;
        
        if (resultSection) {
            gsap.to(window, { 
                duration: 0.5, 
                scrollTo: { 
                    y: resultSection, 
                    offsetY: navbarHeight + 40 
                }, 
                ease: "power2.inOut" 
            });
        }

        const destination = destinationInput?.value.trim() || '';
        const duration = durationInput?.value || '3';
        const interests = Array.from(activeInterests).join(', ') || 'General sightseeing';
        const ageGroup = ageGroupSelect?.value || 'adult';
        const tripVibe = vibeTextarea?.value.trim() || 'A standard, well-rounded experience';

        if (!destination) {
            displayError("Please enter a destination.");
            return;
        }
        
        const prompt = `You are a world-class travel agent AI. Create a highly personalized travel itinerary based on these user-provided details:
- **Destination**: ${destination}
- **Trip Duration**: ${duration} days
- **Budget Level**: ${activeBudget || 'Not specified'}
- **Age Group**: ${ageGroup || 'Not specified'}
- **Main Interests**: ${interests}
- **Desired Trip Vibe**: "${tripVibe}"
- **Location Preference**: ${activeSpotPreference || 'No preference'}

Please generate a detailed, day-by-day plan that includes:
1. A creative title that reflects each day's theme
2. 2-4 activities per day
3. Specific suggestions for breakfast, lunch, and dinner
4. Accommodation recommendations that fit the budget and vibe

Format the response as a valid JSON object matching this schema: ${JSON.stringify(itinerarySchema, null, 2)}`;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-pro",
            generationConfig: {
                responseMimeType: "application/json"
            }
        });
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Could not find valid JSON in the response');
        }
        
        const itinerary = JSON.parse(jsonMatch[0]);
        displayItinerary(itinerary);
    } catch (e) {
        console.error('Error generating or parsing itinerary:', e);
        displayError('Failed to generate itinerary. Please try again.');
    } finally {
        setUILoading(false);
    }
};

// --- Event Listeners ---
const setupEventListeners = () => {
    // Theme toggle
    themeToggle?.addEventListener('click', handleThemeToggle);
    
    // Start planning button
    if (startPlanningBtn && mainContent) {
        startPlanningBtn.addEventListener('click', () => {
            const navbarHeight = header?.offsetHeight || 0;
            gsap.to(window, { 
                duration: 1, 
                scrollTo: { 
                    y: mainContent, 
                    offsetY: navbarHeight 
                }, 
                ease: "power2.inOut" 
            });
        });
    }

    // Budget control
    budgetControl?.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        if (target.tagName === 'BUTTON') {
            budgetControl.querySelector('.active')?.classList.remove('active');
            target.classList.add('active');
            activeBudget = target.dataset.value || 'medium';
        }
    });

    // Spot preference control
    spotPreferenceControl?.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        if (target.tagName === 'BUTTON') {
            spotPreferenceControl.querySelector('.active')?.classList.remove('active');
            target.classList.add('active');
            activeSpotPreference = target.dataset.value || 'Popular TouristSpots';
        }
    });

    // Interests group
    interestsGroup?.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        if (target.tagName === 'BUTTON') {
            target.classList.toggle('active');
            const interest = target.dataset.value || '';
            if (activeInterests.has(interest)) {
                activeInterests.delete(interest);
            } else if (interest) {
                activeInterests.add(interest);
            }
        }
    });

    // Navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = (e.currentTarget as HTMLElement).dataset.page;
            if (page) {
                navigateTo(page);
            }
        });
    });

    // Logo link
    logoLink?.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('home');
    });

    // Form submission
    plannerForm?.addEventListener('submit', handleFormSubmit);

    // Hash change
    window.addEventListener('hashchange', () => {
        const target = (location.hash === '#about') ? 'about' : 'home';
        setInitialPage(target);
    });
};

// --- App Initialization ---
const runMainApp = () => {
    setupGuide?.classList.add('hidden');
    const initialPage = (location.hash === '#about') ? 'about' : 'home';
    setInitialPage(initialPage);
    initializeTheme();
    setupEventListeners();
};

// Start the app when the DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
