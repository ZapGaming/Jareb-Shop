// ==UserScript==
// @name         The Jareb Shop (Tampermonkey System)
// @namespace    http://tampermonkey.net/
// @version      1.24
// @description  A plugin for Discord to earn "Jareb coins" with Tampermonkey-based persistence and custom badges. Now with a password-protected developer zone.
// @author       Gemini
// @match        https://discord.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION & DEFAULTS ---
    const LOCAL_STORAGE_KEY = 'jarebShopState_v1_23';
    const INVISIBLE_KEY = 'jareb-theme-crazy\u200B';
    const COINS_PER_STREAK = 10;
    const COINS_PER_MESSAGE_BASE = 1;
    const COINS_PER_50_CHARS = 1;
    const DEV_ZONE_PASSWORD = 'heykidwantahotdog';

    // --- STATE MANAGEMENT ---
    let jarebState = GM_getValue(LOCAL_STORAGE_KEY, {
        coins: 0,
        unlockedThemes: [],
        unlockedBadges: [],
        dailyStreak: 0,
        lastLoginDate: null,
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

        // If this is the first time, start the streak
        if (!lastLogin) {
            jarebState.dailyStreak = 1;
            showToast('Welcome! Your daily streak has begun (Day 1).');
        } else {
            const timeDifference = today.getTime() - lastLogin.getTime();
            // Check if login was yesterday
            if (timeDifference > 0 && timeDifference <= oneDay) {
                jarebState.dailyStreak++;
                const bonusCoins = jarebState.dailyStreak * COINS_PER_STREAK;
                jarebState.coins += bonusCoins;
                showToast(`Daily streak! Day ${jarebState.dailyStreak}. You earned a bonus of ${bonusCoins} coins! Total: ${jarebState.coins}`);
            } else if (timeDifference > oneDay) {
                // Streak is broken
                jarebState.dailyStreak = 1;
                showToast('Your streak was broken. But you are back on track! (Day 1)');
            } else {
                // Logged in on the same day, do nothing.
                return;
            }
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
            @keyframes jareb-psychedelic-gradient {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            @keyframes animated-frost-blur {
                0% { backdrop-filter: blur(2px) brightness(1.0); }
                50% { backdrop-filter: blur(6px) brightness(1.2); }
                100% { backdrop-filter: blur(2px) brightness(1.0); }
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
            .jareb-badge {
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

            /* --- Custom Themes --- */
            .jareb-crazy-theme {
                background: linear-gradient(45deg, #ff00ff, #00ffff, #ff0000, #ffff00);
                background-size: 400% 400%;
                animation: jareb-psychedelic-gradient 10s ease infinite;
                border-radius: 8px;
                padding: 10px;
            }
        `;
        GM_addStyle(css, 'jareb-shop-styles');
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
     * Copies text to the clipboard.
     * @param {string} text The text to copy.
     */
    function copyToClipboard(text) {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast('Text copied to clipboard!');
    }

    /**
     * Injects the shop button into the Discord UI.
     */
    function injectShopButton() {
        // Find a more stable parent element for the button, e.g., the panels wrapper
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
        const shopItems = [
            { name: "Rainbow Name", cost: 100, description: "Makes your username cycle through a rainbow of colors.", type: 'theme' },
            { name: "Animated Status", cost: 250, description: "Adds a cool animation to your status message.", type: 'theme' },
            { name: "Jareb Sound Effect", cost: 50, description: "Plays a fun sound effect every time you send a message.", type: 'theme' },
            { name: "Crazy Profile Theme", cost: 500, description: "Unlocks a crazy, custom theme for your profile that others with the plugin can see.", type: 'theme' },
            { name: "Shiny Star Badge", cost: 150, description: "Displays a shiny star next to your name on your profile pop-out.", type: 'badge', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" class="jareb-badge"><path fill="#ffcc00" d="M316.9 18C324.6 24.3 329.1 33.5 329.1 43.1v108c0 10.7 2.1 21.2 6.1 31.1l-60 148.9c-2.4 5.9-1.2 12.6 3 17.7s10.6 6.6 16.5 4.1l148.9-60c9.9 4 20.4 6.1 31.1 6.1H533c9.6 0 18.8-4.5 25.1-12.2s9.2-17.2 9.2-27.2l-21.6-129.5c-1.3-7.6-4.9-14.7-10.4-20.2s-12.6-9-20.2-10.4L337.3 18.9c-10-1.8-19.1 2.3-27.2 9.2zm-155.6 92.4l-118-47.2c-5.9-2.4-12.6-1.2-17.7 3s-6.6 10.6-4.1 16.5l47.2 118c2.1 5.2 3.1 10.9 3.1 16.7v97c0 10.7-2.1 21.2-6.1 31.1l-60 148.9c-2.4 5.9-1.2 12.6 3 17.7s10.6 6.6 16.5 4.1l148.9-60c9.9 4 20.4 6.1 31.1 6.1H490.9c9.6 0 18.8-4.5 25.1-12.2s9.2-17.2 9.2-27.2l-21.6-129.5c-1.3-7.6-4.9-14.7-10.4-20.2s-12.6-9-20.2-10.4L188 98.4z"/></svg>`},
            { name: "Lightning Bolt Badge", cost: 200, description: "Displays a cool lightning bolt next to your name on your profile pop-out.", type: 'badge', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" class="jareb-badge"><path fill="#5d8bcf" d="M152 48a24 24 0 0 1-20.6-11.8C126.1 27.2 115.3 16 102.7 16H24c-13.2 0-24 10.8-24 24s10.8 24 24 24H80.5L34.1 251.4c-4.3 22.9 8.2 46.1 30.1 54.3L192 365.1V288c0-13.2 10.8-24 24-24s24 10.8 24 24v50.2l76.2 30.5c23.2 9.3 49.3-2.6 59.6-25.8s-2.6-49.3-25.8-59.6L232 232V184a24 24 0 0 1 20.6-11.8C258 172.8 268.7 160 281.3 160h78.7c13.2 0 24-10.8 24-24s-10.8-24-24-24H281.3c-13.4 0-25.2 6.6-32.3 17.7l-94 141c-7.3 11-19.1 17.3-31.9 17.3H152V48zM192 488c0 13.2-10.8 24-24 24H24c-13.2 0-24-10.8-24-24s10.8-24 24-24h144c13.2 0 24 10.8 24 24z"/></svg>`},
        ];

        shopItems.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.classList.add('jareb-shop-item');
            itemElement.dataset.itemName = item.name;

            const details = document.createElement('div');
            details.innerHTML = `
                <h3 style="color: var(--header-primary); margin: 0; font-size: 16px;">${item.name}</h3>
                <p style="color: var(--text-muted); margin: 4px 0 0; font-size: 12px;">${item.description}</p>
                <p style="color: var(--interactive-normal); margin: 4px 0 0; font-weight: bold;">Cost: ${item.cost} Jareb Coins</p>
            `;

            const purchaseButton = document.createElement('button');
            purchaseButton.classList.add('jareb-purchase-button');

            const isUnlocked = item.type === 'theme' ? jarebState.unlockedThemes.includes(item.name) : jarebState.unlockedBadges.includes(item.name);
            purchaseButton.textContent = isUnlocked ? 'Unlocked' : 'Buy';
            purchaseButton.disabled = isUnlocked;

            purchaseButton.onclick = () => {
                if (deductCoins(item.cost)) {
                    if (item.type === 'theme') {
                        jarebState.unlockedThemes.push(item.name);
                    } else if (item.type === 'badge') {
                        jarebState.unlockedBadges.push(item.name);
                    }
                    saveState();
                    updateShopItemUI(itemElement, item);
                }
            };

            itemElement.appendChild(details);
            itemElement.appendChild(purchaseButton);
            container.appendChild(itemElement);

            if (isUnlocked) {
                updateShopItemUI(itemElement, item);
            }
        });
    }

    /**
     * Updates a single shop item's state after a purchase.
     * @param {HTMLElement} itemElement The item's parent container.
     * @param {object} item The item object.
     */
    function updateShopItemUI(itemElement, item) {
        const purchaseButton = itemElement.querySelector('button');
        if (purchaseButton) {
            purchaseButton.textContent = 'Unlocked';
            purchaseButton.disabled = true;
        }

        if (item.type === 'theme' && item.name === 'Crazy Profile Theme') {
            const copyMessage = document.createElement('div');
            copyMessage.innerHTML = `
                <p style="color: var(--text-normal); margin-top: 10px;">
                    This theme is unlocked! To activate, paste the invisible text into your "About Me".
                </p>
                <button style="background-color: var(--brand-experiment); color: #fff; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer; margin-top: 10px;">
                    Copy Invisible Text
                </button>
            `;
            copyMessage.querySelector('button').onclick = () => copyToClipboard(INVISIBLE_KEY);
            itemElement.appendChild(copyMessage);
        }
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
            jarebState = { coins: 0, unlockedThemes: [], unlockedBadges: [], dailyStreak: 0, lastLoginDate: null };
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
     * Applies the "crazy" profile theme to the given profile node.
     * @param {HTMLElement} profileNode The profile pop-out element.
     */
    function applyCrazyTheme(profileNode) {
        const userContainer = profileNode.querySelector('div[class*="userInfo"]');
        if (!userContainer) return;
        if (jarebState.unlockedThemes.includes('Crazy Profile Theme')) {
            if (userContainer.classList.contains('jareb-crazy-theme')) {
                return;
            }
            userContainer.classList.add('jareb-crazy-theme');
        }
    }

    /**
     * Applies the custom badges to the profile pop-out.
     * @param {HTMLElement} profileNode The profile pop-out element.
     */
    function applyCustomBadges(profileNode) {
        const badgeListContainer = profileNode.querySelector('div[class*="profileBadges"]');
        if (!badgeListContainer) return;

        if (badgeListContainer.querySelector('.jareb-badge-container')) {
            return;
        }

        const customBadgesContainer = document.createElement('div');
        customBadgesContainer.classList.add('jareb-badge-container');

        const badges = {
            'Shiny Star Badge': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" class="jareb-badge"><path fill="#ffcc00" d="M316.9 18C324.6 24.3 329.1 33.5 329.1 43.1v108c0 10.7 2.1 21.2 6.1 31.1l-60 148.9c-2.4 5.9-1.2 12.6 3 17.7s10.6 6.6 16.5 4.1l148.9-60c9.9 4 20.4 6.1 31.1 6.1H533c9.6 0 18.8-4.5 25.1-12.2s9.2-17.2 9.2-27.2l-21.6-129.5c-1.3-7.6-4.9-14.7-10.4-20.2s-12.6-9-20.2-10.4L337.3 18.9c-10-1.8-19.1 2.3-27.2 9.2zm-155.6 92.4l-118-47.2c-5.9-2.4-12.6-1.2-17.7 3s-6.6 10.6-4.1 16.5l47.2 118c2.1 5.2 3.1 10.9 3.1 16.7v97c0 10.7-2.1 21.2-6.1 31.1l-60 148.9c-2.4 5.9-1.2 12.6 3 17.7s10.6 6.6 16.5 4.1l148.9-60c9.9 4 20.4 6.1 31.1 6.1H490.9c9.6 0 18.8-4.5 25.1-12.2s9.2-17.2 9.2-27.2l-21.6-129.5c-1.3-7.6-4.9-14.7-10.4-20.2s-12.6-9-20.2-10.4L188 98.4z"/></svg>`,
            'Lightning Bolt Badge': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" class="jareb-badge"><path fill="#5d8bcf" d="M152 48a24 24 0 0 1-20.6-11.8C126.1 27.2 115.3 16 102.7 16H24c-13.2 0-24 10.8-24 24s10.8 24 24 24H80.5L34.1 251.4c-4.3 22.9 8.2 46.1 30.1 54.3L192 365.1V288c0-13.2 10.8-24 24-24s24 10.8 24 24v50.2l76.2 30.5c23.2 9.3 49.3-2.6 59.6-25.8s-2.6-49.3-25.8-59.6L232 232V184a24 24 0 0 1 20.6-11.8C258 172.8 268.7 160 281.3 160h78.7c13.2 0 24-10.8 24-24s-10.8-24-24-24H281.3c-13.4 0-25.2 6.6-32.3 17.7l-94 141c-7.3 11-19.1 17.3-31.9 17.3H152V48zM192 488c0 13.2-10.8 24-24 24H24c-13.2 0-24-10.8-24-24s10.8-24 24-24h144c13.2 0 24 10.8 24 24z"/></svg>`,
        };

        jarebState.unlockedBadges.forEach(badgeName => {
            const svgCode = badges[badgeName];
            if (svgCode) {
                const badgeElement = document.createElement('div');
                badgeElement.innerHTML = svgCode;
                badgeElement.setAttribute('title', badgeName);
                customBadgesContainer.appendChild(badgeElement);
            }
        });

        if (customBadgesContainer.childElementCount > 0) {
            badgeListContainer.appendChild(customBadgesContainer);
        }
    }

    /**
     * Entry point of the script.
     */
    function init() {
        applyStyles();
        checkDailyStreak(); // Check and update the streak on every page load.

        // Observer for injecting the shop button
        const buttonObserver = new MutationObserver(() => injectShopButton());
        buttonObserver.observe(document.body, { childList: true, subtree: true });

        // Observer for detecting and styling user profiles
        const profileObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        const profileModal = node.querySelector('div[role="dialog"][aria-label*="User Profile"]');
                        if (profileModal) {
                            const aboutMe = profileModal.querySelector('div[class*="aboutMeText"]');
                            if (aboutMe && aboutMe.textContent.includes(INVISIBLE_KEY)) {
                                applyCrazyTheme(profileModal);
                            }
                            applyCustomBadges(profileModal);
                        }
                    }
                });
            });
        });
        profileObserver.observe(document.body, { childList: true, subtree: true });

        // Start listening for messages to award coins
        const messageObserver = new MutationObserver(() => {
            // Re-select the message box to ensure we have the latest element
            const messageBox = document.querySelector('div[role="textbox"]');
            if (messageBox) {
                // Ensure the event listener is not added multiple times
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

        // Initial injection on page load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectShopButton);
        } else {
            injectShopButton();
        }
    }

    init();
})();


    init();
})();
