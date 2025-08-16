import { GoogleGenAI } from '@google/genai';
import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

gsap.registerPlugin(ScrollToPlugin);

// --- State ---
const API_KEY = (typeof window !== 'undefined' && window.GEMINI_API_KEY) || undefined;
let ai;
let isLoading = false;
let isNavigating = false;
let currentPage = '';
let activeBudget = 'Mid-Range';
let activeSpotPreference = 'Popular TouristSpots';
const activeInterests = new Set();

// --- DOM Elements ---
const preloader = document.getElementById('preloader');
const header = document.querySelector('header');
const navLinks = document.querySelectorAll('.nav-link');
const logoLink = document.querySelector('.logo');
const homePage = document.getElementById('home-page');
const aboutPage = document.getElementById('about-page');
const setupGuide = document.getElementById('setup-guide');
const themeToggle = document.getElementById('theme-toggle');
const themeIconSun = document.getElementById('theme-icon-sun');
const themeIconMoon = document.getElementById('theme-icon-moon');
const startPlanningBtn = document.getElementById('start-planning-btn');
const mainContent = document.getElementById('main-content');
const plannerForm = document.getElementById('planner-form');
const destinationInput = document.getElementById('destination-input');
const durationInput = document.getElementById('duration-input');
const ageGroupSelect = document.getElementById('age-group-select');
const vibeTextarea = document.getElementById('vibe-textarea');
const spotPreferenceControl = document.getElementById('spot-preference-control');
const budgetControl = document.getElementById('budget-control');
const interestsGroup = document.getElementById('interests-group');
const generateBtn = document.getElementById('generate-btn');
const resultSection = document.getElementById('result-section');

// --- Schema (as plain object for validation in prompt only) ---
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
          activities: { type: 'array', items: { type: 'string' } },
          food: {
            type: 'object',
            properties: {
              breakfast: { type: 'string' },
              lunch: { type: 'string' },
              dinner: { type: 'string' },
            },
          },
          accommodation: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
            },
          },
        },
        required: ['day', 'title', 'activities', 'food', 'accommodation'],
      },
    },
  },
  required: ['destinationName', 'tripTitle', 'summary', 'dailyPlans'],
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
  const apiKey = (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) || API_KEY;
  if (!apiKey || apiKey === 'PASTE_YOUR_API_KEY_HERE' || apiKey === 'YOUR_API_KEY_HERE') {
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
  setupGuide.classList.add('hidden');
  const initial = (location.hash === '#about') ? 'about' : 'home';
  setInitialPage(initial);

  themeToggle && themeToggle.addEventListener('click', handleThemeToggle);
  startPlanningBtn && startPlanningBtn.addEventListener('click', () => {
    const navbarHeight = (header && header.offsetHeight) || 0;
    gsap.to(window, { duration: 1, scrollTo: { y: mainContent, offsetY: navbarHeight }, ease: 'power2.inOut' });
  });
  budgetControl && budgetControl.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.tagName === 'BUTTON') {
      const active = budgetControl.querySelector('.active');
      if (active) active.classList.remove('active');
      target.classList.add('active');
      activeBudget = target.dataset.value || 'Mid-Range';
    }
  });
  spotPreferenceControl && spotPreferenceControl.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.tagName === 'BUTTON') {
      const active = spotPreferenceControl.querySelector('.active');
      if (active) active.classList.remove('active');
      target.classList.add('active');
      activeSpotPreference = target.dataset.value || 'Popular TouristSpots';
    }
  });
  interestsGroup && interestsGroup.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.tagName === 'BUTTON') {
      target.classList.toggle('active');
      const interest = target.dataset.value || '';
      if (activeInterests.has(interest)) activeInterests.delete(interest); else if (interest) activeInterests.add(interest);
    }
  });
  plannerForm && plannerForm.addEventListener('submit', handleFormSubmit);

  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page) navigateTo(page);
    });
  });
  logoLink && logoLink.addEventListener('click', (e) => { e.preventDefault(); navigateTo('home'); });

  window.addEventListener('hashchange', () => {
    const target = (location.hash === '#about') ? 'about' : 'home';
    setInitialPage(target);
  });
};

// --- Navigation ---
const setInitialPage = (page) => {
  homePage.classList.add('hidden');
  aboutPage.classList.add('hidden');
  if (page === 'home') homePage.classList.remove('hidden');
  else if (page === 'about') aboutPage.classList.remove('hidden');
  window.scrollTo(0, 0);
  navLinks.forEach(link => link.classList.toggle('active', link.dataset.page === page));
  currentPage = page;
};

const navigateTo = (page) => {
  if (page === currentPage || isNavigating) {
    if (page === 'home' && window.scrollY > 0) {
      gsap.to(window, { duration: 1, scrollTo: { y: 0 }, ease: 'power2.inOut' });
    }
    return;
  }
  isNavigating = true;
  if (preloader) {
    preloader.style.display = 'flex';
    requestAnimationFrame(() => preloader.classList.remove('fade-out'));
  }
  setTimeout(() => {
    setInitialPage(page);
    if (preloader) preloader.classList.add('fade-out');
    setTimeout(() => { isNavigating = false; }, 500);
  }, 1000);
};

// --- Theme Logic ---
const applyTheme = (theme) => {
  document.body.classList.toggle('dark-mode', theme === 'dark');
  if (themeIconSun) themeIconSun.classList.toggle('hidden', theme === 'dark');
  if (themeIconMoon) themeIconMoon.classList.toggle('hidden', theme === 'light');
  localStorage.setItem('voyage-ai-theme', theme);
};

const handleThemeToggle = () => {
  const isDarkMode = document.body.classList.contains('dark-mode');
  applyTheme(isDarkMode ? 'light' : 'dark');
};

const initializeTheme = () => {
  const savedTheme = localStorage.getItem('voyage-ai-theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
};

// --- UI Logic ---
const setUILoading = (loading) => {
  isLoading = loading;
  if (!generateBtn) return;
  generateBtn.disabled = loading;
  const btnSpan = generateBtn.querySelector('span');
  if (!btnSpan) return;
  if (loading) {
    btnSpan.textContent = 'Generating...';
    resultSection.innerHTML = `
      <div id="loader">
        <div class="plane-loader">
          <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </div>
        <p>Crafting your personal journey...</p>
      </div>`;
    resultSection.classList.remove('hidden');
  } else {
    btnSpan.textContent = 'Generate Itinerary';
  }
};

const displayError = (message) => {
  resultSection.innerHTML = `<div id="error-message"><strong>Oops!</strong> ${message}</div>`;
  resultSection.classList.remove('hidden');
};

const handleDownloadPdf = async (button, itinerary) => {
  button.disabled = true;
  const originalContent = button.innerHTML;
  button.innerHTML = `
    <svg class="icon-spinner" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>`;

  const itineraryCard = document.getElementById('itinerary-card');
  const accordionItems = Array.from(itineraryCard.querySelectorAll('.accordion-item'));
  const originalStates = [];

  accordionItems.forEach(item => {
    const header = item.querySelector('.accordion-header');
    const content = item.querySelector('.accordion-content');
    const isExpanded = header.getAttribute('aria-expanded') === 'true';
    originalStates.push({ expanded: isExpanded, maxHeight: content.style.maxHeight });
    header.setAttribute('aria-expanded', 'true');
    content.style.maxHeight = content.scrollHeight + 'px';
    const icon = header.querySelector('.accordion-icon');
    if (icon) icon.style.transform = 'rotate(180deg)';
  });

  await new Promise(r => setTimeout(r, 100));

  try {
    const canvas = await html2canvas(itineraryCard, {
      scale: 2,
      backgroundColor: document.body.classList.contains('dark-mode') ? '#1F2937' : '#ffffff',
      useCORS: true,
      windowWidth: itineraryCard.scrollWidth,
      windowHeight: itineraryCard.scrollHeight,
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
    const fileName = `VoyageAI-${(itinerary.destinationName || 'Destination').replace(/[\s,]/g, '_')}-Itinerary.pdf`;
    pdf.save(fileName);
  } catch (err) {
    console.error('Failed to generate PDF:', err);
    displayError('Could not generate the PDF. Please try again.');
  } finally {
    const itineraryCard2 = document.getElementById('itinerary-card');
    Array.from(itineraryCard2.querySelectorAll('.accordion-item')).forEach((item, index) => {
      const header = item.querySelector('.accordion-header');
      const content = item.querySelector('.accordion-content');
      const original = originalStates[index];
      header.setAttribute('aria-expanded', String(original.expanded));
      content.style.maxHeight = original.expanded ? content.scrollHeight + 'px' : '';
      const icon = header.querySelector('.accordion-icon');
      if (icon) icon.style.transform = original.expanded ? 'rotate(180deg)' : 'rotate(0deg)';
    });
    button.disabled = false;
    button.innerHTML = originalContent;
  }
};

const displayItinerary = (itinerary) => {
  let html = `
    <div id="itinerary-card">
      <div class="card-actions">
        <button class="action-btn" id="download-btn" title="Download as PDF">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </button>
      </div>
      <h2 class="itinerary-title">${itinerary.tripTitle}</h2>
      <p class="itinerary-summary">${itinerary.summary}</p>
      <div class="accordion">`;

  itinerary.dailyPlans.forEach((day) => {
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
              <ul>${day.activities.map((item) => `<li>${item}</li>`).join('')}</ul>
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
      </div>`;
  });
  html += '</div></div>';
  resultSection.innerHTML = html;
  resultSection.classList.remove('hidden');

  const downloadBtn = document.getElementById('download-btn');
  if (downloadBtn) downloadBtn.addEventListener('click', () => handleDownloadPdf(downloadBtn, itinerary));

  document.querySelectorAll('.accordion-header').forEach((button) => {
    button.addEventListener('click', () => {
      const content = button.nextElementSibling;
      const icon = button.querySelector('.accordion-icon');
      const isExpanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!isExpanded));
      if (icon) icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
      if (content.style.maxHeight) content.style.maxHeight = '';
      else content.style.maxHeight = content.scrollHeight + 'px';
    });
  });
};

const handleFormSubmit = async (event) => {
  event.preventDefault();
  if (isLoading || !ai) return;
  const destination = destinationInput.value.trim();
  const duration = durationInput.value;
  const interests = Array.from(activeInterests).join(', ') || 'General sightseeing';
  const ageGroup = ageGroupSelect.value;
  const tripVibe = vibeTextarea.value.trim();
  if (!destination) { displayError('Please enter a destination.'); return; }

  setUILoading(true);
  const navbarHeight = (header && header.offsetHeight) || 0;
  gsap.to(window, { duration: 0.5, scrollTo: { y: resultSection, offsetY: navbarHeight + 40 } });

  const prompt = `You are a world-class travel agent AI. Create a highly personalized travel itinerary based on these details:\n- Destination: ${destination}\n- Trip Duration: ${duration} days\n- Budget Level: ${activeBudget}\n- Age Group: ${ageGroup}\n- Main Interests: ${interests}\n- Desired Trip Vibe: "${tripVibe || 'A standard, well-rounded experience.'}"\n- Location Preference: ${activeSpotPreference}\n\nReturn a valid JSON object strictly matching this schema: ${JSON.stringify(itinerarySchema)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });
    const jsonString = (response && response.text && response.text.trim && response.text.trim()) || '';
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    const itinerary = JSON.parse(jsonMatch[0]);
    displayItinerary(itinerary);
  } catch (error) {
    console.error(error);
    const errorMessage = (error && error.message) || 'Unknown error generating itinerary.';
    displayError(`We couldn't generate your itinerary. Please try again. Details: ${errorMessage}`);
  } finally {
    setUILoading(false);
  }
};

// --- App Initialization ---
const handlePreloader = () => {
  if (!preloader) {
    initializeTheme();
    initializeApp();
    return;
  }
  setTimeout(() => {
    preloader.classList.add('fade-out');
    const onEnd = () => {
      preloader.style.display = 'none';
      document.querySelectorAll('.content-hidden').forEach(el => {
        el.classList.remove('content-hidden');
        el.classList.add('content-visible');
      });
      initializeTheme();
      initializeApp();
      preloader.removeEventListener('transitionend', onEnd);
    };
    preloader.addEventListener('transitionend', onEnd);
  }, 3000);
};

document.addEventListener('DOMContentLoaded', handlePreloader);
