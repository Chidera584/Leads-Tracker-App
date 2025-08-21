import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js"
import { getDatabase, ref, push, onValue, remove, set } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-database.js"

// Firebase Configuration
const firebaseConfig = {
    databaseURL: "https://leads-tracker-app-1fb76-default-rtdb.europe-west1.firebasedatabase.app/"
}

const app = initializeApp(firebaseConfig)
const database = getDatabase(app)
const referenceInDB = ref(database, "leads")

// DOM Elements
const inputEl = document.getElementById("input-el")
const titleEl = document.getElementById("title-el")
const inputBtn = document.getElementById("input-btn")
const currentTabBtn = document.getElementById("current-tab-btn")
const ulEl = document.getElementById("ul-el")
const deleteAllBtn = document.getElementById("delete-all")
const searchEl = document.getElementById("search-el")
const leadsCount = document.getElementById("leads-count")
const emptyState = document.getElementById("empty-state")
const clearInputBtn = document.getElementById("clear-input")
const selectAllBtn = document.getElementById("select-all")
const deleteSelectedBtn = document.getElementById("delete-selected")
const filterButtons = document.querySelectorAll(".filter-btn")
const modalOverlay = document.getElementById("modal-overlay")
const modalTitle = document.getElementById("modal-title")
const modalMessage = document.getElementById("modal-message")
const modalConfirm = document.getElementById("modal-confirm")
const modalCancel = document.getElementById("modal-cancel")
const modalClose = document.getElementById("modal-close")

// State Management
let allLeads = []
let filteredLeads = []
let selectedLeads = new Set()
let currentFilter = 'all'
let favorites = JSON.parse(localStorage.getItem('leadsFavorites') || '[]')

// Utility Functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function formatDate(timestamp) {
    const date = new Date(timestamp)
    const now = new Date()
    const diffTime = Math.abs(now - date)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'Today'
    if (diffDays === 2) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays - 1} days ago`
    
    return date.toLocaleDateString()
}

function isValidUrl(string) {
    try {
        new URL(string)
        return true
    } catch (_) {
        return false
    }
}

function extractDomain(url) {
    try {
        return new URL(url).hostname.replace('www.', '')
    } catch (_) {
        return url
    }
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div')
    toast.className = `toast ${type}`
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i>
        ${message}
    `
    
    const container = document.getElementById('toast-container')
    container.appendChild(toast)
    
    setTimeout(() => {
        toast.classList.add('removing')
        setTimeout(() => container.removeChild(toast), 300)
    }, 3000)
}

function showModal(title, message, onConfirm) {
    modalTitle.textContent = title
    modalMessage.textContent = message
    modalOverlay.classList.add('show')
    
    const handleConfirm = () => {
        modalOverlay.classList.remove('show')
        onConfirm()
        modalConfirm.removeEventListener('click', handleConfirm)
    }
    
    modalConfirm.addEventListener('click', handleConfirm)
}

function updateLeadsCount() {
    const count = filteredLeads.length
    leadsCount.textContent = `${count} lead${count !== 1 ? 's' : ''}`
}

function updateEmptyState() {
    if (filteredLeads.length === 0) {
        emptyState.style.display = 'block'
        ulEl.style.display = 'none'
    } else {
        emptyState.style.display = 'none'
        ulEl.style.display = 'block'
    }
}

function updateSelectAllButton() {
    const hasLeads = filteredLeads.length > 0
    const allSelected = hasLeads && selectedLeads.size === filteredLeads.length
    
    selectAllBtn.innerHTML = allSelected 
        ? '<i class="fas fa-square"></i> Deselect All'
        : '<i class="fas fa-check-square"></i> Select All'
    
    deleteSelectedBtn.style.display = selectedLeads.size > 0 ? 'block' : 'none'
}

function toggleFavorite(leadId) {
    const index = favorites.indexOf(leadId)
    if (index > -1) {
        favorites.splice(index, 1)
    } else {
        favorites.push(leadId)
    }
    localStorage.setItem('leadsFavorites', JSON.stringify(favorites))
    applyFilter()
}

function deleteLead(leadId) {
    const leadRef = ref(database, `leads/${leadId}`)
    remove(leadRef)
    selectedLeads.delete(leadId)
    showToast('Lead deleted successfully')
}

function applyFilter() {
    let filtered = [...allLeads]
    
    // Apply search filter
    const searchTerm = searchEl.value.toLowerCase().trim()
    if (searchTerm) {
        filtered = filtered.filter(lead => 
            lead.url.toLowerCase().includes(searchTerm) ||
            (lead.title && lead.title.toLowerCase().includes(searchTerm))
        )
    }
    
    // Apply category filter
    switch (currentFilter) {
        case 'recent':
            const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000)
            filtered = filtered.filter(lead => lead.timestamp > threeDaysAgo)
            break
        case 'favorites':
            filtered = filtered.filter(lead => favorites.includes(lead.id))
            break
    }
    
    filteredLeads = filtered
    render()
}

function render() {
    if (filteredLeads.length === 0) {
        updateEmptyState()
        updateLeadsCount()
        updateSelectAllButton()
        return
    }
    
    // Sort by timestamp (newest first)
    const sortedLeads = [...filteredLeads].sort((a, b) => b.timestamp - a.timestamp)
    
    let listItems = ""
    sortedLeads.forEach(lead => {
        const isSelected = selectedLeads.has(lead.id)
        const isFavorite = favorites.includes(lead.id)
        const domain = extractDomain(lead.url)
        
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
                                <button class="action-btn delete" title="Delete lead">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </li>
        `
    })
    
    ulEl.innerHTML = listItems
    updateEmptyState()
    updateLeadsCount()
    updateSelectAllButton()
    
    // Add event listeners to new elements
    addLeadEventListeners()
}

function addLeadEventListeners() {
    // Checkbox listeners
    document.querySelectorAll('.lead-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const leadItem = e.target.closest('.lead-item')
            const leadId = leadItem.dataset.id
            
            if (e.target.checked) {
                selectedLeads.add(leadId)
                leadItem.classList.add('selected')
            } else {
                selectedLeads.delete(leadId)
                leadItem.classList.remove('selected')
            }
            
            updateSelectAllButton()
        })
    })
    
    // Action button listeners
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault()
            const leadItem = e.target.closest('.lead-item')
            const leadId = leadItem.dataset.id
            const lead = allLeads.find(l => l.id === leadId)
            
            if (btn.classList.contains('favorite')) {
                toggleFavorite(leadId)
            } else if (btn.classList.contains('copy')) {
                navigator.clipboard.writeText(lead.url).then(() => {
                    showToast('URL copied to clipboard!')
                }).catch(() => {
                    showToast('Failed to copy URL', 'error')
                })
            } else if (btn.classList.contains('delete')) {
                showModal(
                    'Delete Lead',
                    'Are you sure you want to delete this lead?',
                    () => deleteLead(leadId)
                )
            }
        })
    })
}

// Event Listeners
inputEl.addEventListener('input', () => {
    clearInputBtn.classList.toggle('show', inputEl.value.length > 0)
})

clearInputBtn.addEventListener('click', () => {
    inputEl.value = ''
    titleEl.value = ''
    clearInputBtn.classList.remove('show')
    inputEl.focus()
})

inputBtn.addEventListener("click", () => {
    const url = inputEl.value.trim()
    const title = titleEl.value.trim()
    
    if (!url) {
        showToast('Please enter a URL', 'error')
        return
    }
    
    if (!isValidUrl(url)) {
        showToast('Please enter a valid URL', 'error')
        return
    }
    
    const leadData = {
        id: generateId(),
        url: url,
        title: title || null,
        timestamp: Date.now()
    }
    
    inputBtn.classList.add('loading')
    
    const leadRef = ref(database, `leads/${leadData.id}`)
    set(leadRef, leadData).then(() => {
        inputEl.value = ""
        titleEl.value = ""
        clearInputBtn.classList.remove('show')
        inputBtn.classList.remove('loading')
        showToast('Lead saved successfully!')
    }).catch(() => {
        inputBtn.classList.remove('loading')
        showToast('Failed to save lead', 'error')
    })
})

// Handle Enter key in input fields
inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        inputBtn.click()
    }
})

titleEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        inputBtn.click()
    }
})

currentTabBtn.addEventListener("click", () => {
    // For Chrome extension functionality
    if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0]
            inputEl.value = currentTab.url
            titleEl.value = currentTab.title
            clearInputBtn.classList.add('show')
            showToast('Current tab loaded!')
        })
    } else {
        // Fallback for web version
        inputEl.value = window.location.href
        titleEl.value = document.title
        clearInputBtn.classList.add('show')
        showToast('Current page loaded!')
    }
})

searchEl.addEventListener('input', applyFilter)

selectAllBtn.addEventListener('click', () => {
    const allSelected = selectedLeads.size === filteredLeads.length
    
    if (allSelected) {
        selectedLeads.clear()
        document.querySelectorAll('.lead-checkbox').forEach(cb => {
            cb.checked = false
            cb.closest('.lead-item').classList.remove('selected')
        })
    } else {
        filteredLeads.forEach(lead => selectedLeads.add(lead.id))
        document.querySelectorAll('.lead-checkbox').forEach(cb => {
            cb.checked = true
            cb.closest('.lead-item').classList.add('selected')
        })
    }
    
    updateSelectAllButton()
})

deleteSelectedBtn.addEventListener('click', () => {
    const count = selectedLeads.size
    showModal(
        'Delete Selected Leads',
        `Are you sure you want to delete ${count} selected lead${count !== 1 ? 's' : ''}?`,
        () => {
            selectedLeads.forEach(leadId => {
                const leadRef = ref(database, `leads/${leadId}`)
                remove(leadRef)
            })
            selectedLeads.clear()
            showToast(`${count} lead${count !== 1 ? 's' : ''} deleted successfully`)
        }
    )
})

deleteAllBtn.addEventListener("click", () => {
    if (allLeads.length === 0) {
        showToast('No leads to delete', 'warning')
        return
    }
    
    showModal(
        'Delete All Leads',
        `Are you sure you want to delete all ${allLeads.length} leads? This action cannot be undone.`,
        () => {
            remove(referenceInDB).then(() => {
                selectedLeads.clear()
                showToast('All leads deleted successfully')
            })
        }
    )
})

// Filter button listeners
filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        currentFilter = btn.dataset.filter
        applyFilter()
    })
})

// Modal listeners
modalCancel.addEventListener('click', () => {
    modalOverlay.classList.remove('show')
})

modalClose.addEventListener('click', () => {
    modalOverlay.classList.remove('show')
})

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        modalOverlay.classList.remove('show')
    }
})

// Firebase listener
onValue(referenceInDB, (snapshot) => {
    if (snapshot.exists()) {
        const snapshotValues = snapshot.val()
        allLeads = Object.entries(snapshotValues).map(([id, data]) => ({
            id,
            ...data
        }))
    } else {
        allLeads = []
    }
    
    applyFilter()
})

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    initializeTheme()
    
    // Focus on input field
    inputEl.focus()
    
    // Initialize filter
    applyFilter()
})