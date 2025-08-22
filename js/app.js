import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, set } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-database.js";
import { capacitorManager } from './capacitor-init.js';

// Firebase Configuration
const firebaseConfig = {
    databaseURL: "https://leads-tracker-app-1fb76-default-rtdb.europe-west1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const referenceInDB = ref(database, "leads");

// DOM Elements
const inputEl = document.getElementById("input-el");
const titleEl = document.getElementById("title-el");
const inputBtn = document.getElementById("input-btn");
const ulEl = document.getElementById("ul-el");
const deleteAllBtn = document.getElementById("delete-all");
const searchEl = document.getElementById("search-el");
const leadsCount = document.getElementById("leads-count");
const totalLeadsEl = document.getElementById("total-leads");
const favoriteLeadsEl = document.getElementById("favorite-leads");
const recentLeadsEl = document.getElementById("recent-leads");
const emptyState = document.getElementById("empty-state");
const clearInputBtn = document.getElementById("clear-input");
const clearSearchBtn = document.getElementById("clear-search");
const selectAllBtn = document.getElementById("select-all");
const deleteSelectedBtn = document.getElementById("delete-selected");
const filterTabs = document.querySelectorAll(".filter-tab");
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalMessage = document.getElementById("modal-message");
const modalConfirm = document.getElementById("modal-confirm");
const modalCancel = document.getElementById("modal-cancel");
const modalClose = document.getElementById("modal-close");
const themeToggle = document.getElementById("theme-toggle");
const loadingOverlay = document.getElementById("loading-overlay");

// State Management
let allLeads = [];
let filteredLeads = [];
let selectedLeads = new Set();
let currentFilter = 'all';
let favorites = JSON.parse(localStorage.getItem('leadsFavorites') || '[]');

// Theme Management
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 
                      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    const icon = themeToggle.querySelector('i');
    if (theme === 'dark') {
        icon.className = 'fas fa-sun';
        themeToggle.title = 'Switch to light theme';
    } else {
        icon.className = 'fas fa-moon';
        themeToggle.title = 'Switch to dark theme';
    }

    // Update status bar for native app
    capacitorManager.updateStatusBar(theme === 'dark');
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    showToast(`Switched to ${newTheme} theme`, 'success');
    capacitorManager.vibrate();
}

// Utility Functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return date.toLocaleDateString();
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function extractDomain(url) {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch (_) {
        return url;
    }
}

function showLoading(show = true) {
    loadingOverlay.classList.toggle('show', show);
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i>
        ${message}
    `;
    
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

function showModal(title, message, onConfirm) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalOverlay.classList.add('show');
    
    const handleConfirm = () => {
        modalOverlay.classList.remove('show');
        onConfirm();
        modalConfirm.removeEventListener('click', handleConfirm);
        capacitorManager.vibrate();
    };
    
    modalConfirm.addEventListener('click', handleConfirm);
}

function updateStats() {
    const total = allLeads.length;
    const favCount = allLeads.filter(lead => favorites.includes(lead.id)).length;
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    const recentCount = allLeads.filter(lead => lead.timestamp > threeDaysAgo).length;
    
    totalLeadsEl.textContent = total;
    favoriteLeadsEl.textContent = favCount;
    recentLeadsEl.textContent = recentCount;
    
    const count = filteredLeads.length;
    leadsCount.textContent = `${count} lead${count !== 1 ? 's' : ''}`;
}

function updateEmptyState() {
    if (filteredLeads.length === 0) {
        emptyState.style.display = 'block';
        ulEl.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        ulEl.style.display = 'block';
    }
}

function updateSelectAllButton() {
    const hasLeads = filteredLeads.length > 0;
    const allSelected = hasLeads && selectedLeads.size === filteredLeads.length;
    
    const icon = selectAllBtn.querySelector('i');
    const text = selectAllBtn.querySelector('span');
    
    if (allSelected) {
        icon.className = 'fas fa-square';
        text.textContent = 'Deselect All';
    } else {
        icon.className = 'fas fa-check-square';
        text.textContent = 'Select All';
    }
    
    deleteSelectedBtn.style.display = selectedLeads.size > 0 ? 'block' : 'none';
}

function toggleFavorite(leadId) {
    const index = favorites.indexOf(leadId);
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(leadId);
    }
    localStorage.setItem('leadsFavorites', JSON.stringify(favorites));
    applyFilter();
    capacitorManager.vibrate();
}

function deleteLead(leadId) {
    showLoading(true);
    const leadRef = ref(database, `leads/${leadId}`);
    remove(leadRef).then(() => {
        selectedLeads.delete(leadId);
        showToast('Lead deleted successfully');
        showLoading(false);
        capacitorManager.vibrate();
    }).catch(() => {
        showToast('Failed to delete lead', 'error');
        showLoading(false);
    });
}

function applyFilter() {
    let filtered = [...allLeads];
    
    // Apply search filter
    const searchTerm = searchEl.value.toLowerCase().trim();
    if (searchTerm) {
        filtered = filtered.filter(lead => 
            lead.url.toLowerCase().includes(searchTerm) ||
            (lead.title && lead.title.toLowerCase().includes(searchTerm))
        );
    }
    
    // Apply category filter
    switch (currentFilter) {
        case 'recent':
            const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
            filtered = filtered.filter(lead => lead.timestamp > threeDaysAgo);
            break;
        case 'favorites':
            filtered = filtered.filter(lead => favorites.includes(lead.id));
            break;
    }
    
    filteredLeads = filtered;
    render();
}

function addRippleEffect(button, event) {
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    const ripple = document.createElement('div');
    ripple.className = 'btn-ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    
    button.appendChild(ripple);
    
    setTimeout(() => {
        if (button.contains(ripple)) {
            button.removeChild(ripple);
        }
    }, 600);
}

function render() {
    if (filteredLeads.length === 0) {
        updateEmptyState();
        updateStats();
        updateSelectAllButton();
        return;
    }
    
    // Sort by timestamp (newest first)
    const sortedLeads = [...filteredLeads].sort((a, b) => b.timestamp - a.timestamp);
    
    let listItems = "";
    sortedLeads.forEach(lead => {
        const isSelected = selectedLeads.has(lead.id);
        const isFavorite = favorites.includes(lead.id);
        const domain = extractDomain(lead.url);
        
        listItems += `
            <li class="lead-item ${isSelected ? 'selected' : ''}" data-id="${lead.id}">
                <div class="lead-header">
                    <input type="checkbox" class="lead-checkbox" ${isSelected ? 'checked' : ''}>
                    <div class="lead-content">
                        ${lead.title ? `<div class="lead-title">${lead.title}</div>` : ''}
                        <a href="${lead.url}" target="_blank" class="lead-url" title="${lead.url}">
                            ${domain}
                        </a>
                        <div class="lead-meta">
                            <span class="lead-date">
                                <i class="fas fa-clock"></i>
                                ${formatDate(lead.timestamp)}
                            </span>
                            <div class="lead-actions">
                                <button class="action-btn favorite ${isFavorite ? 'active' : ''}" title="Toggle favorite">
                                    <i class="fas fa-star"></i>
                                </button>
                                <button class="action-btn copy" title="Copy URL">
                                    <i class="fas fa-copy"></i>
                                </button>
                                <button class="action-btn share" title="Share">
                                    <i class="fas fa-share"></i>
                                </button>
                                <button class="action-btn delete" title="Delete lead">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </li>
        `;
    });
    
    ulEl.innerHTML = listItems;
    updateEmptyState();
    updateStats();
    updateSelectAllButton();
    
    // Add event listeners to new elements
    addLeadEventListeners();
}

function addLeadEventListeners() {
    // Checkbox listeners
    document.querySelectorAll('.lead-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const leadItem = e.target.closest('.lead-item');
            const leadId = leadItem.dataset.id;
            
            if (e.target.checked) {
                selectedLeads.add(leadId);
                leadItem.classList.add('selected');
            } else {
                selectedLeads.delete(leadId);
                leadItem.classList.remove('selected');
            }
            
            updateSelectAllButton();
            capacitorManager.vibrate();
        });
    });
    
    // Action button listeners
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const leadItem = e.target.closest('.lead-item');
            const leadId = leadItem.dataset.id;
            const lead = allLeads.find(l => l.id === leadId);
            
            if (btn.classList.contains('favorite')) {
                toggleFavorite(leadId);
            } else if (btn.classList.contains('copy')) {
                try {
                    await navigator.clipboard.writeText(lead.url);
                    showToast('URL copied to clipboard!');
                    capacitorManager.vibrate();
                } catch {
                    showToast('Failed to copy URL', 'error');
                }
            } else if (btn.classList.contains('share')) {
                if (navigator.share) {
                    try {
                        await navigator.share({
                            title: lead.title || 'Shared Lead',
                            url: lead.url
                        });
                        capacitorManager.vibrate();
                    } catch (error) {
                        if (error.name !== 'AbortError') {
                            showToast('Failed to share', 'error');
                        }
                    }
                } else {
                    // Fallback to copy
                    try {
                        await navigator.clipboard.writeText(lead.url);
                        showToast('URL copied to clipboard!');
                        capacitorManager.vibrate();
                    } catch {
                        showToast('Sharing not supported', 'error');
                    }
                }
            } else if (btn.classList.contains('delete')) {
                showModal(
                    'Delete Lead',
                    'Are you sure you want to delete this lead?',
                    () => deleteLead(leadId)
                );
            }
        });
    });
}

// Event Listeners
themeToggle.addEventListener('click', toggleTheme);

// Input management
inputEl.addEventListener('input', () => {
    clearInputBtn.classList.toggle('show', inputEl.value.length > 0);
});

clearInputBtn.addEventListener('click', () => {
    inputEl.value = '';
    titleEl.value = '';
    clearInputBtn.classList.remove('show');
    inputEl.focus();
    capacitorManager.vibrate();
});

// Search management
searchEl.addEventListener('input', () => {
    clearSearchBtn.classList.toggle('show', searchEl.value.length > 0);
    applyFilter();
});

clearSearchBtn.addEventListener('click', () => {
    searchEl.value = '';
    clearSearchBtn.classList.remove('show');
    applyFilter();
    capacitorManager.vibrate();
});

// Add lead
inputBtn.addEventListener("click", (e) => {
    addRippleEffect(inputBtn, e);
    
    const url = inputEl.value.trim();
    const title = titleEl.value.trim();
    
    if (!url) {
        showToast('Please enter a URL', 'error');
        return;
    }
    
    if (!isValidUrl(url)) {
        showToast('Please enter a valid URL', 'error');
        return;
    }
    
    const leadData = {
        id: generateId(),
        url: url,
        title: title || null,
        timestamp: Date.now()
    };
    
    inputBtn.classList.add('loading');
    
    const leadRef = ref(database, `leads/${leadData.id}`);
    set(leadRef, leadData).then(() => {
        inputEl.value = "";
        titleEl.value = "";
        clearInputBtn.classList.remove('show');
        inputBtn.classList.remove('loading');
        showToast('Lead saved successfully!');
        capacitorManager.vibrate();
    }).catch(() => {
        inputBtn.classList.remove('loading');
        showToast('Failed to save lead', 'error');
    });
});

// Handle Enter key in input fields
inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        inputBtn.click();
    }
});

titleEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        inputBtn.click();
    }
});

// Select all functionality
selectAllBtn.addEventListener('click', () => {
    const allSelected = selectedLeads.size === filteredLeads.length;
    
    if (allSelected) {
        selectedLeads.clear();
        document.querySelectorAll('.lead-checkbox').forEach(cb => {
            cb.checked = false;
            cb.closest('.lead-item').classList.remove('selected');
        });
    } else {
        filteredLeads.forEach(lead => selectedLeads.add(lead.id));
        document.querySelectorAll('.lead-checkbox').forEach(cb => {
            cb.checked = true;
            cb.closest('.lead-item').classList.add('selected');
        });
    }
    
    updateSelectAllButton();
    capacitorManager.vibrate();
});

// Delete selected
deleteSelectedBtn.addEventListener('click', () => {
    const count = selectedLeads.size;
    showModal(
        'Delete Selected Leads',
        `Are you sure you want to delete ${count} selected lead${count !== 1 ? 's' : ''}?`,
        () => {
            showLoading(true);
            const deletePromises = Array.from(selectedLeads).map(leadId => {
                const leadRef = ref(database, `leads/${leadId}`);
                return remove(leadRef);
            });
            
            Promise.all(deletePromises).then(() => {
                selectedLeads.clear();
                showToast(`${count} lead${count !== 1 ? 's' : ''} deleted successfully`);
                showLoading(false);
                capacitorManager.vibrate();
            }).catch(() => {
                showToast('Failed to delete some leads', 'error');
                showLoading(false);
            });
        }
    );
});

// Delete all
deleteAllBtn.addEventListener("click", () => {
    if (allLeads.length === 0) {
        showToast('No leads to delete', 'warning');
        return;
    }
    
    showModal(
        'Delete All Leads',
        `Are you sure you want to delete all ${allLeads.length} leads? This action cannot be undone.`,
        () => {
            showLoading(true);
            remove(referenceInDB).then(() => {
                selectedLeads.clear();
                showToast('All leads deleted successfully');
                showLoading(false);
                capacitorManager.vibrate();
            }).catch(() => {
                showToast('Failed to delete leads', 'error');
                showLoading(false);
            });
        }
    );
});

// Filter tabs
filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        applyFilter();
        capacitorManager.vibrate();
    });
});

// Modal listeners
modalCancel.addEventListener('click', () => {
    modalOverlay.classList.remove('show');
});

modalClose.addEventListener('click', () => {
    modalOverlay.classList.remove('show');
});

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        modalOverlay.classList.remove('show');
    }
});

// Firebase listener
onValue(referenceInDB, (snapshot) => {
    if (snapshot.exists()) {
        const snapshotValues = snapshot.val();
        allLeads = Object.entries(snapshotValues).map(([id, data]) => ({
            id,
            ...data
        }));
    } else {
        allLeads = [];
    }
    
    applyFilter();
});

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    initializeTheme();
    
    // Focus on input field
    inputEl.focus();
    
    // Initialize filter
    applyFilter();
    
    console.log('Leads Tracker Pro initialized');
});

// Add toast container styles
const toastStyles = `
.toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: var(--z-toast);
    max-width: 300px;
}

.toast {
    background: var(--toast-bg);
    color: white;
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    margin-bottom: 8px;
    box-shadow: var(--shadow-lg);
    transform: translateX(100%);
    animation: slideIn 0.3s ease forwards;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
}

.toast.success {
    background: var(--success-color);
}

.toast.error {
    background: var(--danger-color);
}

.toast.warning {
    background: var(--warning-color);
}

@keyframes slideIn {
    to {
        transform: translateX(0);
    }
}

.toast.removing {
    animation: slideOut 0.3s ease forwards;
}

@keyframes slideOut {
    to {
        transform: translateX(100%);
    }
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--modal-overlay);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
    backdrop-filter: blur(4px);
    transition: var(--transition-normal);
}

.modal-overlay.show {
    display: flex;
}

.modal {
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    max-width: 320px;
    width: 90%;
    box-shadow: var(--shadow-xl);
    transform: scale(0.9);
    transition: transform var(--transition-normal);
}

.modal-overlay.show .modal {
    transform: scale(1);
}

.modal-header {
    padding: var(--spacing-lg) var(--spacing-lg) 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-header h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
}

.modal-close {
    background: none;
    border: none;
    font-size: 18px;
    color: var(--text-muted);
    cursor: pointer;
    padding: var(--spacing-sm);
    border-radius: var(--radius-full);
    transition: var(--transition-fast);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-close:hover {
    background: var(--border-color);
    color: var(--text-secondary);
}

.modal-body {
    padding: var(--spacing-lg);
    text-align: center;
}

.modal-icon {
    width: 60px;
    height: 60px;
    background: var(--danger-light);
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto var(--spacing-lg);
}

.modal-icon i {
    font-size: 24px;
    color: var(--danger-color);
}

.modal-body p {
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
}

.modal-footer {
    padding: 0 var(--spacing-lg) var(--spacing-lg);
    display: flex;
    gap: var(--spacing-md);
    justify-content: flex-end;
}

.modal-footer .btn {
    padding: var(--spacing-md) var(--spacing-lg);
    font-size: 13px;
    min-height: 40px;
}
`;

// Inject toast styles
const styleSheet = document.createElement('style');
styleSheet.textContent = toastStyles;
document.head.appendChild(styleSheet);