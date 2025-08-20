// ==UserScript==
// @name        The Jareb Shop (Tampermonkey System)
// @namespace   http://tampermonkey.net/
// @version     1.49
// @description A plugin for Discord to earn "Jareb coins" with Tampermonkey-based persistence and custom CSS theme support. This version fixes the minimalist layout's toggle button functionality.
// @author      Gemini
// @match       https://discord.com/*
// @grant       GM_addStyle
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION & DEFAULTS ---
    const LOCAL_STORAGE_KEY = 'jarebShopState_v1_49';
    const COINS_PER_STREAK = 10;
    const COINS_PER_MESSAGE_BASE = 1;
    const COINS_PER_50_CHARS = 1;
    const DEV_ZONE_PASSWORD = 'heykidwantahotdog';
    const CUSTOM_THEME_STYLE_ID = 'jareb-custom-css-theme';
    const MINIMALIST_THEME_STYLE_ID = 'jareb-minimalist-theme-styles';
    const SIDEBAR_TOGGLE_BUTTON_ID = 'jareb-sidebar-toggle-button';
    const MINIMALIST_CLASS = 'jareb-minimalist-active';

    // Centralized data for shop items
    const THEMES = {
        'Custom CSS Theme': { cost: 500, description: "Unlocks the ability to apply any custom CSS theme from a URL to the entire Discord client.", type: 'theme' },
        'Minimalist Layout': { cost: 100, description: "Hides the sidebars for a full-screen chat experience. Includes a toggle button to show them again.", type: 'theme' }
    };
    const ALL_SHOP_ITEMS = { ...THEMES };

    // --- STATE MANAGEMENT ---
    let jarebState = GM_getValue(LOCAL_STORAGE_KEY, {
        coins: 0,
        unlockedThemes: [],
        dailyStreak: 0,
        lastLoginDate: null,
        activeThemeUrl: null,
        activeThemeName: null
    });

    /**
     * Saves the current state object using GM_setValue.
     */
    function saveState() {
        GM_setValue(LOCAL_STORAGE_KEY, jarebState);
    }

    /**
     * Checks and updates the daily streak on script load.
     */
    function checkDailyStreak() {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to midnight for accurate comparison
        const lastLogin = jarebState.lastLoginDate ? new Date(jarebState.lastLoginDate) : null;
        const oneDay = 24 * 60 * 60 * 1000;

        if (!lastLogin || today.getTime() > lastLogin.getTime() + oneDay) {
            jarebState.dailyStreak = 1;
            showToast('Welcome! Your daily streak has begun (Day 1).');
        } else if (today.getTime() === lastLogin.getTime() + oneDay) {
            jarebState.dailyStreak++;
            const bonusCoins = jarebState.dailyStreak * COINS_PER_STREAK;
            jarebState.coins += bonusCoins;
            showToast(`Daily streak! Day ${jarebState.dailyStreak}. You earned a bonus of ${bonusCoins} coins! Total: ${jarebState.coins}`);
        } else if (today.getTime() < lastLogin.getTime()) {
             jarebState.dailyStreak = 1;
        }

        jarebState.lastLoginDate = today.toISOString();
        saveState();
        updateCoinDisplay();
    }

    // --- UI STYLES ---
    function applyStyles() {
        const css = `
            @keyframes fadeIn { from { opacity: 0; } }
            @keyframes modalPopIn { from { opacity: 0; transform: scale(.95); } to { opacity: 1; transform: scale(1); } }
            @keyframes jareb-rainbow-text {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }

            /* --- Shop Button & Toast --- */
            #jareb-shop-button {
                background-color: var(--background-secondary);
                color: var(--interactive-normal);
                border: none;
                border-radius: 4px;
                padding: 8px 12px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                font-family: Inter, sans-serif;
                width: 100%;
                transition: color 0.15s ease-in-out;
                margin-top: 8px;
            }
            #jareb-shop-button:hover { color: var(--interactive-hover); }

            #jareb-shop-toast {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background-color: rgba(54, 57, 63, 0.9);
                color: #fff;
                padding: 10px 20px;
                border-radius: 8px;
                font-family: Inter, sans-serif;
                font-size: 14px;
                z-index: 9999;
                transition: opacity 0.3s ease-in-out;
                opacity: 0;
                pointer-events: none;
            }

            /* --- Shop Modal --- */
            #jareb-shop-modal-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                animation: fadeIn .3s ease;
            }

            #jareb-shop-modal-content {
                background: var(--background-secondary-alt);
                border: 1px solid var(--background-modifier-accent);
                border-radius: 15px;
                color: var(--text-primary);
                padding: 20px;
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
                position: relative;
                animation: modalPopIn .3s ease;
            }
            #jareb-shop-modal-content h2 {
                border-bottom: 2px solid var(--interactive-active);
                padding-bottom: 5px;
                margin-bottom: 20px;
            }
            #jareb-shop-modal-close-button {
                position: absolute;
                top: 10px;
                right: 15px;
                background: none;
                border: none;
                color: var(--text-muted);
                font-size: 2em;
                cursor: pointer;
                transition: color .2s;
            }
            #jareb-shop-modal-close-button:hover { color: var(--interactive-hover); }

            /* --- Shared UI Elements --- */
            .jareb-title {
                text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
                backdrop-filter: blur(2px);
                background-color: rgba(255, 255, 255, 0.1);
                padding: 5px 10px;
                border-radius: 8px;
                animation: animated-frost-blur 4s infinite alternate;
                color: var(--header-primary);
            }
            .jareb-tabs-container {
                display: flex;
            }
            .jareb-tab-button {
                background-color: transparent;
                border: none;
                color: var(--interactive-normal);
                padding: 8px 12px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                font-family: Inter, sans-serif;
                margin-left: 8px;
            }
            .jareb-tab-button:hover { color: var(--interactive-hover); }
            .jareb-shop-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background-color: var(--background-secondary);
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 10px;
                border: 1px solid var(--background-modifier-accent);
            }
            .jareb-purchase-button {
                background-color: var(--brand-experiment);
                color: #fff;
                border: none;
                border-radius: 4px;
                padding: 8px 16px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: background-color 0.15s ease-in-out;
            }
            .jareb-purchase-button:disabled {
                background-color: var(--status-positive);
                opacity: 0.7;
                cursor: not-allowed;
            }
            .jareb-custom-badge {
                width: 20px;
                height: 20px;
                margin-left: 5px;
            }
            .jareb-badge-container {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                margin-top: 10px;
            }
            .jareb-input {
                background-color: var(--background-secondary-alt);
                border: 1px solid var(--background-modifier-accent);
                border-radius: 4px;
                color: var(--text-normal);
                padding: 8px;
                width: 100%;
                margin-top: 10px;
            }
            .jareb-rainbow-name {
                background: linear-gradient(to right, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3);
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-size: 200% auto;
                animation: jareb-rainbow-text 5s linear infinite;
                display: inline-block;
            }
            .jareb-custom-theme-input-container {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-top: 10px;
            }
            .jareb-custom-theme-input-container input {
                flex-grow: 1;
            }
        `;
        GM_addStyle(css, 'jareb-shop-styles');
        // Apply the saved theme on script load
        if (jarebState.activeThemeName) {
            applyTheme(jarebState.activeThemeName, jarebState.activeThemeUrl);
        }
    }

    /**
     * Applies a theme based on its name.
     * @param {string} themeName The name of the theme to apply.
     * @param {string} [themeUrl] Optional URL for a custom theme.
     */
    function applyTheme(themeName, themeUrl) {
        // First, disable any currently active theme
        disableTheme();

        // Apply the new theme based on its name
        switch (themeName) {
            case 'Custom CSS Theme':
                if (themeUrl) {
                    applyCustomThemeFromUrl(themeUrl);
                }
                break;
            case 'Minimalist Layout':
                applyMinimalistLayout();
                break;
        }

        // Update state and display
        jarebState.activeThemeName = themeName;
        jarebState.activeThemeUrl = themeUrl;
        saveState();
    }

    /**
     * Disables any currently active theme by removing its CSS.
     */
    function disableTheme() {
        const customTheme = document.getElementById(CUSTOM_THEME_STYLE_ID);
        if (customTheme) {
            customTheme.remove();
        }
        const minimalistTheme = document.getElementById(MINIMALIST_THEME_STYLE_ID);
        if (minimalistTheme) {
            minimalistTheme.remove();
        }

        const appMount = document.getElementById('app-mount');
        if (appMount) {
             appMount.classList.remove(MINIMALIST_CLASS);
        }

        const toggleButton = document.getElementById(SIDEBAR_TOGGLE_BUTTON_ID);
        if (toggleButton) {
            toggleButton.remove();
        }

        jarebState.activeThemeName = null;
        jarebState.activeThemeUrl = null;
        saveState();
        showToast('Theme disabled.');
    }

    /**
     * Applies the specific CSS for the minimalist layout theme.
     */
    function applyMinimalistLayout() {
        // Find the main app container
        const appMount = document.getElementById('app-mount');
        if (!appMount) {
            showToast('Could not find Discord app container.');
            return;
        }

        // Apply the CSS based on the new class
        GM_addStyle(`
            /* The CSS will only apply when the parent has our custom class */
            .${MINIMALIST_CLASS} [class*="guilds_"] {
                display: none !important;
            }

            .${MINIMALIST_CLASS} [class*="sidebar_"] {
                display: none !important;
            }

            .${MINIMALIST_CLASS} [class*="chat_"] {
                width: 100% !important;
                left: 0 !important;
                margin-left: 0 !important;
            }

            #${SIDEBAR_TOGGLE_BUTTON_ID} {
                position: fixed;
                top: 10px;
                left: 10px;
                background-color: rgba(0, 0, 0, 0.4);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                padding: 10px;
                cursor: pointer;
                font-family: sans-serif;
                z-index: 1000;
                transition: background-color 0.2s ease-in-out;
            }
            #${SIDEBAR_TOGGLE_BUTTON_ID}:hover {
                background-color: rgba(0, 0, 0, 0.6);
            }
        `, MINIMALIST_THEME_STYLE_ID);

        // Add the class to activate the CSS rules
        appMount.classList.add(MINIMALIST_CLASS);

        // Add the toggle button
        let toggleButton = document.getElementById(SIDEBAR_TOGGLE_BUTTON_ID);
        if (!toggleButton) {
            toggleButton = document.createElement('button');
            toggleButton.id = SIDEBAR_TOGGLE_BUTTON_ID;
            toggleButton.textContent = 'Toggle Sidebars';
            toggleButton.onclick = () => {
                const appContainer = document.getElementById('app-mount');
                if (appContainer) {
                    appContainer.classList.toggle(MINIMALIST_CLASS);
                }
            };
            document.body.appendChild(toggleButton);
        }

        showToast('Minimalist Layout applied!');
    }

    /**
     * Applies a custom CSS theme from a URL.
     * @param {string} url The URL of the CSS file.
     */
    function applyCustomThemeFromUrl(url) {
        if (!url) {
            disableTheme();
            return;
        }

        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            onload: function(response) {
                if (response.status === 200) {
                    GM_addStyle(response.responseText, CUSTOM_THEME_STYLE_ID);
                    jarebState.activeThemeUrl = url;
                    saveState();
                    showToast('Custom theme applied successfully!');
                } else {
                    showToast(`Failed to load theme. Status: ${response.status}`);
                    jarebState.activeThemeUrl = null;
                    saveState();
                }
            },
            onerror: function() {
                showToast('Failed to load theme. Check the URL.');
                jarebState.activeThemeUrl = null;
                saveState();
            }
        });
    }

    // --- CORE LOGIC ---

    /**
     * Adds coins to the balance and updates GM_setValue.
     * @param {number} amount The amount of coins to add.
     */
    function addCoins(amount) {
        jarebState.coins += amount;
        showToast(`+${amount} Jareb Coin${amount > 1 ? 's' : ''}! Total: ${jarebState.coins}`);
        updateCoinDisplay();
        saveState();
    }

    /**
     * Deducts coins from the balance and updates GM_setValue.
     * @param {number} amount The amount of coins to deduct.
     * @returns {boolean} True if the purchase was successful, false otherwise.
     */
    function deductCoins(amount) {
        if (jarebState.coins >= amount) {
            jarebState.coins -= amount;
            saveState();
            showToast(`Purchase successful! Remaining: ${jarebState.coins}`);
            return true;
        } else {
            showToast(`Not enough Jareb coins! Need ${amount - jarebState.coins} more.`);
            return false;
        }
    }

    // --- UI CREATION AND MANAGEMENT ---

    /**
     * Shows a temporary toast notification with a message.
     * @param {string} message The message to display.
     */
    function showToast(message) {
        let toast = document.getElementById('jareb-shop-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'jareb-shop-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.opacity = '1';
        clearTimeout(toast.timeout);
        toast.timeout = setTimeout(() => {
            toast.style.opacity = '0';
        }, 3000);
    }

    /**
     * Updates the UI to show the current coin balance and streak count.
     */
    function updateCoinDisplay() {
        const coinDisplay = document.getElementById('jareb-coins-display');
        if (coinDisplay) {
            coinDisplay.textContent = `${jarebState.coins} Jareb Coins (Streak: ${jarebState.dailyStreak})`;
        }
    }

    /**
     * Injects the shop button into the Discord UI.
     */
    function injectShopButton() {
        const panels = document.querySelector('[class*="panels_"]');
        if (panels && !document.getElementById('jareb-shop-button')) {
            const button = document.createElement('button');
            button.id = 'jareb-shop-button';
            button.textContent = 'Jareb Shop';
            button.onclick = openShopModal;
            panels.appendChild(button);
        }
    }

    /**
     * Creates and opens the main modal.
     */
    function openShopModal() {
        if (document.getElementById('jareb-shop-modal-backdrop')) return;

        const backdrop = document.createElement('div');
        backdrop.id = 'jareb-shop-modal-backdrop';
        backdrop.onclick = (e) => {
            if (e.target === backdrop) closeModal();
        };

        const modalContent = document.createElement('div');
        modalContent.id = 'jareb-shop-modal-content';
        modalContent.innerHTML = `
            <button id="jareb-shop-modal-close-button">×</button>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--background-modifier-accent); margin-bottom: 20px; padding-bottom: 10px;">
                <h2 class="jareb-title" style="margin: 0;">The Jareb Shop</h2>
                <div class="jareb-tabs-container">
                    <button class="jareb-tab-button" data-tab="shop">Shop</button>
                    <button class="jareb-tab-button" data-tab="dev">Dev Zone</button>
                </div>
            </div>
            <p id="jareb-coins-display" style="color: var(--text-normal); text-align: center; margin-bottom: 20px; font-size: 16px; font-weight: bold;"></p>
            <div id="jareb-shop-content-area"></div>
        `;

        backdrop.appendChild(modalContent);
        document.body.appendChild(backdrop);
        document.getElementById('jareb-shop-modal-close-button').onclick = closeModal;
        modalContent.querySelectorAll('.jareb-tab-button').forEach(button => {
            button.onclick = () => {
                const tab = button.dataset.tab;
                const contentArea = document.getElementById('jareb-shop-content-area');
                if (tab === 'shop') {
                    displayShop(contentArea);
                } else if (tab === 'dev') {
                    displayDevZone(contentArea);
                }
            };
        });

        updateCoinDisplay();
        displayShop(document.getElementById('jareb-shop-content-area'));
        backdrop.style.display = 'flex';
    }

    /**
     * Displays the shop content in the modal.
     * @param {HTMLElement} container The modal content container.
     */
    function displayShop(container) {
        container.innerHTML = '';
        Object.entries(ALL_SHOP_ITEMS).forEach(([name, item]) => {
            const itemElement = document.createElement('div');
            itemElement.classList.add('jareb-shop-item');
            itemElement.dataset.itemName = name;

            const details = document.createElement('div');
            details.innerHTML = `
                <h3 style="color: var(--header-primary); margin: 0; font-size: 16px;">${name}</h3>
                <p style="color: var(--text-muted); margin: 4px 0 0; font-size: 12px;">${item.description}</p>
                <p style="color: var(--interactive-normal); margin: 4px 0 0; font-weight: bold;">Cost: ${item.cost} Jareb Coins</p>
            `;

            const actionContainer = document.createElement('div');
            actionContainer.style.display = 'flex';
            actionContainer.style.gap = '8px';

            const isUnlocked = jarebState.unlockedThemes.includes(name);

            if (isUnlocked) {
                const applyButton = document.createElement('button');
                applyButton.classList.add('jareb-purchase-button');
                applyButton.textContent = 'Apply';
                applyButton.disabled = jarebState.activeThemeName === name;
                applyButton.onclick = () => {
                    applyTheme(name);
                    // Re-render the shop to update button states
                    displayShop(container);
                };
                actionContainer.appendChild(applyButton);

                const disableButton = document.createElement('button');
                disableButton.classList.add('jareb-purchase-button');
                disableButton.textContent = 'Disable';
                disableButton.style.backgroundColor = 'var(--status-danger)';
                disableButton.disabled = jarebState.activeThemeName !== name;
                disableButton.onclick = () => {
                    disableTheme();
                    displayShop(container);
                };
                actionContainer.appendChild(disableButton);

            } else {
                const buyButton = document.createElement('button');
                buyButton.classList.add('jareb-purchase-button');
                buyButton.textContent = 'Buy';
                buyButton.disabled = jarebState.coins < item.cost;
                buyButton.onclick = () => {
                    if (deductCoins(item.cost)) {
                        jarebState.unlockedThemes.push(name);
                        saveState();
                        // Re-render the shop to show the new buttons
                        displayShop(container);
                    }
                };
                actionContainer.appendChild(buyButton);
            }

            itemElement.appendChild(details);
            itemElement.appendChild(actionContainer);
            container.appendChild(itemElement);

            if (name === 'Custom CSS Theme' && isUnlocked) {
                 updateCustomThemeUI(itemElement);
            }
        });
    }

    /**
     * Updates the UI for the custom CSS theme item.
     * @param {HTMLElement} itemElement The item's parent container.
     */
    function updateCustomThemeUI(itemElement) {
        const container = document.createElement('div');
        container.innerHTML = `
            <p style="color: var(--text-normal); margin-top: 10px;">
                Enter the URL of a public CSS theme to apply it to Discord.
            </p>
            <div class="jareb-custom-theme-input-container">
                <input type="text" id="custom-theme-url" class="jareb-input" placeholder="Enter theme URL...">
                <button id="apply-custom-theme-url" class="jareb-purchase-button">Apply URL</button>
            </div>
        `;
        const urlInput = container.querySelector('#custom-theme-url');
        const applyButton = container.querySelector('#apply-custom-theme-url');

        if (jarebState.activeThemeUrl) {
            urlInput.value = jarebState.activeThemeUrl;
        }

        applyButton.onclick = () => {
            const url = urlInput.value;
            if (url) {
                applyTheme('Custom CSS Theme', url);
            } else {
                showToast('Please enter a valid URL.');
            }
        };

        itemElement.appendChild(container);
    }

    /**
     * Displays the developer zone content.
     * @param {HTMLElement} container The modal content container.
     */
    function displayDevZone(container) {
        container.innerHTML = `
            <p style="color: var(--text-normal); margin-bottom: 10px;">This is the developer zone. Please enter the password to continue.</p>
            <input type="password" id="dev-password-input" class="jareb-input" placeholder="Enter password...">
            <button id="dev-password-submit" class="jareb-purchase-button" style="margin-top: 10px; width: 100%;">Submit</button>
        `;

        const passwordInput = document.getElementById('dev-password-input');
        const submitButton = document.getElementById('dev-password-submit');

        submitButton.onclick = () => {
            if (passwordInput.value === DEV_ZONE_PASSWORD) {
                showDevTools(container);
            } else {
                showToast('Incorrect password!');
                passwordInput.value = '';
            }
        };

        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                submitButton.click();
            }
        });
    }

    /**
     * Shows the developer tools after correct password entry.
     * @param {HTMLElement} container The modal content container.
     */
    function showDevTools(container) {
        container.innerHTML = `
            <h3 style="color: var(--header-primary); margin-bottom: 10px;">Developer Tools</h3>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; gap: 10px; align-items: flex-end;">
                    <div style="flex-grow: 1;">
                        <p style="color: var(--text-normal); margin-bottom: 4px;">Add Custom Coins:</p>
                        <input type="number" id="dev-custom-coins-input" class="jareb-input" placeholder="Enter amount...">
                    </div>
                    <button id="dev-add-custom-coins" class="jareb-purchase-button" style="background-color: var(--status-positive); width: auto;">Add</button>
                </div>
                <button id="dev-reset-all" class="jareb-purchase-button" style="background-color: var(--status-danger); width: 100%;">Reset All Progress</button>
            </div>
        `;

        const customCoinsInput = document.getElementById('dev-custom-coins-input');
        const addCustomCoinsButton = document.getElementById('dev-add-custom-coins');

        addCustomCoinsButton.onclick = () => {
            const amount = parseInt(customCoinsInput.value, 10);
            if (!isNaN(amount) && amount > 0) {
                addCoins(amount);
            } else {
                showToast('Please enter a valid positive number!');
            }
        };

        document.getElementById('dev-reset-all').onclick = () => {
            jarebState = { coins: 0, unlockedThemes: [], dailyStreak: 0, lastLoginDate: null, activeThemeUrl: null };
            saveState();
            updateCoinDisplay();
            showToast('All progress has been reset!');
            closeModal();
        };
    }

    /**
     * Closes the main modal.
     */
    function closeModal() {
        const modal = document.getElementById('jareb-shop-modal-backdrop');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Observes the DOM for the "panels" element to ensure the shop button is injected at the right time.
     */
    function observeAndInject() {
        const observer = new MutationObserver((mutations, obs) => {
            const panels = document.querySelector('[class*="panels_"]');
            if (panels) {
                injectShopButton();
                obs.disconnect(); // Stop observing once the element is found and button injected.
            }
        });
        // Start observing the body for changes
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Entry point of the script.
     */
    function init() {
        applyStyles();
        checkDailyStreak(); // Check and update the streak on every page load.
        observeAndInject();

        // Start listening for messages to award coins
        const messageObserver = new MutationObserver(() => {
            const messageBox = document.querySelector('div[role="textbox"]');
            if (messageBox) {
                if (!messageBox.jarebListenerAttached) {
                    messageBox.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey && messageBox.textContent.trim().length > 0) {
                            const messageLength = messageBox.textContent.trim().length;
                            const bonusCoins = Math.floor(messageLength / 50) * COINS_PER_50_CHARS;
                            const totalCoins = COINS_PER_MESSAGE_BASE + bonusCoins;
                            addCoins(totalCoins);
                        }
                    });
                    messageBox.jarebListenerAttached = true;
                }
            }
        });
        messageObserver.observe(document.body, { childList: true, subtree: true });
    }

    init();
})();


    init();
})();
