/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Type } from '@google/genai';
import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

gsap.registerPlugin(ScrollToPlugin);

// --- State ---
const API_KEY = process.env.GEMINI_API_KEY || (window as any).GEMINI_API_KEY;
let ai: GoogleGenAI;
let isLoading = false;
let isNavigating = false;
let currentPage = '';
let activeBudget = 'Mid-Range';
let activeSpotPreference = 'Popular TouristSpots';
const activeInterests = new Set<string>();

// --- DOM Elements ---
const preloader = document.getElementById('preloader') as HTMLElement;
const header = document.querySelector('header') as HTMLElement;
const navLinks = document.querySelectorAll('.nav-link');
const logoLink = document.querySelector('.logo') as HTMLAnchorElement;

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
const spotPreferenceControl = document.getElementById('spot-preference-control') as HTMLElement;
const budgetControl = document.getElementById('budget-control') as HTMLElement;
const interestsGroup = document.getElementById('interests-group') as HTMLElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const resultSection = document.getElementById('result-section') as HTMLElement;

// --- Itinerary Schema ---
const itinerarySchema = {
    type: Type.OBJECT,
    properties: {
        destinationName: { type: Type.STRING, description: "The name of the destination, e.g., 'Tokyo, Japan'." },
        tripTitle: { type: Type.STRING, description: "A creative and catchy title for the trip. e.g., 'An Adventurous Week in the Swiss Alps'." },
        summary: { type: Type.STRING, description: "A brief, 2-3 sentence summary of the overall trip plan." },
        dailyPlans: {
            type: Type.ARRAY,
            description: "An array of daily plans, one for each day of the trip.",
            items: {
                type: Type.OBJECT,
                properties: {
                    day: { type: Type.INTEGER, description: "The day number (e.g., 1, 2, 3)." },
                    title: { type: Type.STRING, description: "A short, descriptive title for the day's theme. e.g., 'Historic Heart of the City'." },
                    activities: { 
                        type: Type.ARRAY,
                        description: "A list of 2-4 activities for the day.",
                        items: { type: Type.STRING }
                    },
                    food: {
                        type: Type.OBJECT,
                        description: "Suggestions for breakfast, lunch, and dinner.",
                         properties: {
                            breakfast: { type: Type.STRING, description: "A suggestion for a breakfast spot or type of food." },
                            lunch: { type: Type.STRING, description: "A suggestion for a lunch spot or type of food." },
                            dinner: { type: Type.STRING, description: "A suggestion for a dinner spot or type of food." },
                        }
                    },
                    accommodation: {
                        type: Type.OBJECT,
                        description: "A hotel suggestion that fits the user's budget.",
                        properties: {
                            name: { type: Type.STRING, description: "Name of the suggested hotel." },
                            type: { type: Type.STRING, description: "The type of accommodation (e.g., Boutique Hotel, Luxury Resort, Budget Hostel)." },
                        }
                    }
                },
                required: ["day", "title", "activities", "food", "accommodation"]
            }
        }
    },
    required: ["destinationName", "tripTitle", "summary", "dailyPlans"]
};

// --- Core App Logic ---

const showSetupGuide = () => {
    homePage.classList.add('hidden');
    aboutPage.classList.add('hidden');
    setupGuide.classList.remove('hidden');
    setupGuide.innerHTML = `
        <h2>Welcome to VoyageAI!</h2>
        <p>To get started, you need to provide your Google Gemini API key.</p>
        <ol>
            <li>If you don't have one, get a free API key at <strong><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a></strong>.</li>
            <li>Open the <strong><code>config.js</code></strong> file in your project folder.</li>
            <li>Paste your key into the file, replacing <code>"PASTE_YOUR_API_KEY_HERE"</code>.</li>
        </ol>
        <code>window.GEMINI_API_KEY = "YOUR_API_KEY_HERE";</code>
        <p>After adding your key, please <strong>refresh the page</strong>.</p>
    `;
};

const initializeApp = () => {
    const apiKey = process.env.GEMINI_API_KEY || (window as any).GEMINI_API_KEY;

    if (!apiKey || apiKey === "PASTE_YOUR_API_KEY_HERE" || apiKey === "YOUR_API_KEY_HERE") {
        console.error("Initialization Error: API Key not found or is placeholder.");
        // Allow About page to be viewed even without API key
        if (location.hash === '#about') {
            runMainApp();
            return;
        }
        showSetupGuide();
        return; 
    }

    try {
        ai = new GoogleGenAI({ apiKey });
        runMainApp();
    } catch (error) {
        console.error('Initialization Error:', error);
        showSetupGuide();
    }
};

const runMainApp = () => {
    // Hide setup guide and show initial page based on hash
    setupGuide.classList.add('hidden');
    const initial = (location.hash === '#about') ? 'about' : 'home';
    setInitialPage(initial);

    // Attach all event listeners
    themeToggle.addEventListener('click', handleThemeToggle);
    startPlanningBtn.addEventListener('click', () => {
        const navbarHeight = header.offsetHeight;
        gsap.to(window, { duration: 1, scrollTo: { y: mainContent, offsetY: navbarHeight }, ease: "power2.inOut" });
    });
    budgetControl.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        if (target.tagName === 'BUTTON') {
            budgetControl.querySelector('.active')?.classList.remove('active');
            target.classList.add('active');
            activeBudget = target.dataset.value!;
        }
    });
    spotPreferenceControl.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        if (target.tagName === 'BUTTON') {
            spotPreferenceControl.querySelector('.active')?.classList.remove('active');
            target.classList.add('active');
            activeSpotPreference = target.dataset.value!;
        }
    });
    interestsGroup.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        if (target.tagName === 'BUTTON') {
            target.classList.toggle('active');
            const interest = target.dataset.value!;
            if (activeInterests.has(interest)) {
                activeInterests.delete(interest);
            } else {
                activeInterests.add(interest);
            }
        }
    });
    plannerForm.addEventListener('submit', handleFormSubmit);

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = (e.currentTarget as HTMLElement).dataset.page;
            if (page) {
                navigateTo(page);
            }
        });
    });
    logoLink.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('home');
    });

    // Respond to hash changes (e.g., external links to #about)
    window.addEventListener('hashchange', () => {
        const target = (location.hash === '#about') ? 'about' : 'home';
        setInitialPage(target);
    });
};

// --- Navigation ---
const setInitialPage = (page: string) => {
    // Hide all pages
    homePage.classList.add('hidden');
    aboutPage.classList.add('hidden');

    // Show the selected page
    if (page === 'home') {
        homePage.classList.remove('hidden');
    } else if (page === 'about') {
        aboutPage.classList.remove('hidden');
    }
    window.scrollTo(0, 0);

    // Update active nav link
    navLinks.forEach(link => {
        link.classList.toggle('active', (link as HTMLElement).dataset.page === page);
    });
    currentPage = page;
};

const navigateTo = (page: string) => {
    if (page === currentPage || isNavigating) {
        // If clicking 'Home' while on the home page, scroll to top.
        if (page === 'home' && window.scrollY > 0) {
            gsap.to(window, { duration: 1, scrollTo: { y: 0 }, ease: "power2.inOut" });
        }
        return;
    }

    isNavigating = true;
    
    // Show preloader
    preloader.style.display = 'flex';
    requestAnimationFrame(() => {
        preloader.classList.remove('fade-out');
    });

    // Wait and then switch content
    setTimeout(() => {
        setInitialPage(page); // Reuse the logic to switch pages
        preloader.classList.add('fade-out');

        // Reset navigation lock after transition
        setTimeout(() => {
            isNavigating = false;
        }, 500); // Match CSS transition time

    }, 1000); // 1-second preloader for navigation
};

// --- Theme Logic ---
const applyTheme = (theme: 'light' | 'dark') => {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    themeIconSun.classList.toggle('hidden', theme === 'dark');
    themeIconMoon.classList.toggle('hidden', theme === 'light');
    localStorage.setItem('voyage-ai-theme', theme);
};

const handleThemeToggle = () => {
    const isDarkMode = document.body.classList.contains('dark-mode');
    applyTheme(isDarkMode ? 'light' : 'dark');
};

const initializeTheme = () => {
    const savedTheme = localStorage.getItem('voyage-ai-theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
};

// --- UI Logic ---
const setUILoading = (loading: boolean) => {
    isLoading = loading;
    generateBtn.disabled = loading;
    const btnSpan = generateBtn.querySelector('span')!;
    if (loading) {
        btnSpan.textContent = 'Generating...';
        resultSection.innerHTML = `
            <div id="loader">
                <div class="plane-loader">
                    <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </div>
                <p>Crafting your personal journey...</p>
            </div>
        `;
        resultSection.classList.remove('hidden');
    } else {
        btnSpan.textContent = 'Generate Itinerary';
    }
};

const displayError = (message: string) => {
    resultSection.innerHTML = `<div id="error-message"><strong>Oops!</strong> ${message}</div>`;
    resultSection.classList.remove('hidden');
};

const handleDownloadPdf = async (button: HTMLButtonElement, itinerary: any) => {
    button.disabled = true;
    const originalContent = button.innerHTML;
    button.innerHTML = `
         <svg class="icon-spinner" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
    `;

    const itineraryCard = document.getElementById('itinerary-card') as HTMLElement;
    const accordionItems = Array.from(itineraryCard.querySelectorAll('.accordion-item'));
    const originalStates: { expanded: boolean, maxHeight: string }[] = [];

    // Force all accordions open for capture
    accordionItems.forEach(item => {
        const header = item.querySelector('.accordion-header') as HTMLButtonElement;
        const content = item.querySelector('.accordion-content') as HTMLElement;
        const isExpanded = header.getAttribute('aria-expanded') === 'true';
        
        originalStates.push({ expanded: isExpanded, maxHeight: content.style.maxHeight });
        header.setAttribute('aria-expanded', 'true');
        content.style.maxHeight = content.scrollHeight + 'px';
        const icon = header.querySelector('.accordion-icon');
        if (icon) (icon as HTMLElement).style.transform = 'rotate(180deg)';
    });

    // Wait a moment for the DOM to update with the new heights
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        const canvas = await html2canvas(itineraryCard, {
            scale: 2,
            backgroundColor: document.body.classList.contains('dark-mode') ? '#1F2937' : '#ffffff',
            useCORS: true,
            windowWidth: itineraryCard.scrollWidth,
            windowHeight: itineraryCard.scrollHeight
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / canvasHeight;
        const imgHeight = pdfWidth / ratio;
        const pdfHeight = pdf.internal.pageSize.getHeight();
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
        }
        
        const fileName = `VoyageAI-${itinerary.destinationName.replace(/[\s,]/g, '_')}-Itinerary.pdf`;
        pdf.save(fileName);

    } catch(err) {
        console.error("Failed to generate PDF:", err);
        displayError("Could not generate the PDF. Please try again.");
    } finally {
        // Restore original accordion states
        accordionItems.forEach((item, index) => {
            const header = item.querySelector('.accordion-header') as HTMLButtonElement;
            const content = item.querySelector('.accordion-content') as HTMLElement;
            const original = originalStates[index];
            header.setAttribute('aria-expanded', String(original.expanded));
            content.style.maxHeight = original.expanded ? content.scrollHeight + 'px' : '';
            const icon = header.querySelector('.accordion-icon');
            if (icon) (icon as HTMLElement).style.transform = original.expanded ? 'rotate(180deg)' : 'rotate(0deg)';
        });

        button.disabled = false;
        button.innerHTML = originalContent;
    }
};

const displayItinerary = (itinerary: any) => {
    let html = `
        <div id="itinerary-card">
            <div class="card-actions">
                <button class="action-btn" id="download-btn" title="Download as PDF">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </button>
            </div>
            <h2 class="itinerary-title">${itinerary.tripTitle}</h2>
            <p class="itinerary-summary">${itinerary.summary}</p>
            <div class="accordion">
    `;

    itinerary.dailyPlans.forEach((day: any) => {
        html += `
            <div class="accordion-item">
                <button class="accordion-header" aria-expanded="false">
                    <span><strong>Day ${day.day}:</strong> ${day.title}</span>
                    <svg class="accordion-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div class="accordion-content">
                    <div class="day-details">
                        <div class="detail-block">
                            <h4><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> Activities</h4>
                            <ul>${day.activities.map((item: string) => `<li>${item}</li>`).join('')}</ul>
                        </div>
                        <div class="detail-block">
                            <h4><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> Dining</h4>
                             <ul>
                                <li><strong>Breakfast:</strong> ${day.food.breakfast}</li>
                                <li><strong>Lunch:</strong> ${day.food.lunch}</li>
                                <li><strong>Dinner:</strong> ${day.food.dinner}</li>
                            </ul>
                        </div>
                        <div class="detail-block">
                            <h4><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> Accommodation</h4>
                            <p><strong>${day.accommodation.name}</strong> (${day.accommodation.type})</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div></div>';
    resultSection.innerHTML = html;
    resultSection.classList.remove('hidden');

    const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
    if(downloadBtn) {
        downloadBtn.addEventListener('click', () => handleDownloadPdf(downloadBtn, itinerary));
    }
    
    document.querySelectorAll('.accordion-header').forEach(button => {
        button.addEventListener('click', () => {
            const content = button.nextElementSibling as HTMLElement;
            const icon = button.querySelector('.accordion-icon') as HTMLElement;
            const isExpanded = button.getAttribute('aria-expanded') === 'true';

            button.setAttribute('aria-expanded', String(!isExpanded));
            icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
            
            if (content.style.maxHeight) {
                content.style.maxHeight = '';
            } else {
                content.style.maxHeight = content.scrollHeight + 'px';
            }
        });
    });
};

const handleFormSubmit = async (event: Event) => {
    event.preventDefault();
    if (isLoading || !ai) return;

    const destination = destinationInput.value.trim();
    const duration = durationInput.value;
    const interests = Array.from(activeInterests).join(', ') || 'General sightseeing';
    const ageGroup = ageGroupSelect.value;
    const tripVibe = vibeTextarea.value.trim();

    if (!destination) {
        displayError("Please enter a destination.");
        return;
    }
    
    setUILoading(true);
    const navbarHeight = header.offsetHeight;
    gsap.to(window, { duration: 0.5, scrollTo: { y: resultSection, offsetY: navbarHeight + 40 } });

    const prompt = `
        You are a world-class travel agent AI. Create a highly personalized travel itinerary based on these user-provided details:
        - **Destination**: ${destination}
        - **Trip Duration**: ${duration} days
        - **Budget Level**: ${activeBudget}
        - **Age Group**: ${ageGroup}
        - **Main Interests**: ${interests}
        - **Desired Trip Vibe**: "${tripVibe || 'A standard, well-rounded experience.'}"
        - **Location Preference**: The user prefers "${activeSpotPreference}". Please tailor your suggestions for activities, dining, and even accommodation to match this preference. If they chose "Lowkey Hangouts", prioritize local favorites, hidden gems, and less crowded areas over famous landmarks. If they chose "Popular Tourist Spots", focus on the must-see attractions.

        Please generate a detailed, day-by-day plan. For each day, provide:
        1.  A creative title that reflects the day's theme.
        2.  A list of 2-4 activities.
        3.  Specific suggestions for breakfast, lunch, and dinner that align with the vibe and location preference.
        4.  A single accommodation suggestion for the entire trip that fits the budget and overall vibe.

        The output must be in a structured JSON format according to the provided schema. Ensure the tone is exciting and inviting. The destinationName in the JSON should match the user's input.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: itinerarySchema,
            },
        });

        const jsonString = response.text.trim();
        const itinerary = JSON.parse(jsonString);
        displayItinerary(itinerary);

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while generating the itinerary.";
        displayError(`We couldn't generate your itinerary. This could be due to a restricted location or an issue with the AI model. Please try a different destination. Details: ${errorMessage}`);
    } finally {
        setUILoading(false);
    }
};

// --- App Initialization ---
const handlePreloader = () => {
    // Fallback for safety, though preloader should always exist.
    if (!preloader) {
        initializeTheme();
        initializeApp();
        return;
    }

    // Start the 3-second timer
    setTimeout(() => {
        preloader.classList.add('fade-out');
        
        // Listen for the fade-out transition to complete
        preloader.addEventListener('transitionend', () => {
            preloader.style.display = 'none';

            // Make the main content visible with a fade-in effect
            document.querySelectorAll('.content-hidden').forEach(el => {
                el.classList.remove('content-hidden');
                el.classList.add('content-visible');
            });
            
            // Now that content is ready, initialize the app
            initializeTheme();
            initializeApp();
        }, { once: true }); // Use { once: true } to auto-remove the listener

    }, 3000); // 3 seconds
};

document.addEventListener('DOMContentLoaded', handlePreloader);