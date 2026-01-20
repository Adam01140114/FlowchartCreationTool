// Cart Management System
const priceCache = {};

async function fetchStripePrice(priceId) {
    if (priceCache[priceId]) return priceCache[priceId];
    try {
        const res = await fetch(`/stripe-price/${priceId}`, { mode: 'cors' });
        if (!res.ok) return null;
        const data = await res.json();
        priceCache[priceId] = data;
        return data;
    } catch {
        return null;
    }
}

class CartManager {
    constructor() {
        this.cartCookieName = 'formwiz_cart';
        this.cart = this.loadCart();
        this.init();
    }

    loadCart() {
        // Try cookies first
        let cartData = this.getCookie(this.cartCookieName);
        let source = 'cookies';
        
        // Fallback to localStorage if no cookie data
        if (!cartData) {
            cartData = localStorage.getItem(this.cartCookieName);
            source = 'localStorage';
        }
        
        let cart = [];
        if (!cartData) {
            console.log('🛒 No cart data found in cookies or localStorage');
        } else {
            try {
                // Decode URL-encoded data if needed
                const decodedData = cartData.startsWith('%') ? decodeURIComponent(cartData) : cartData;
                cart = JSON.parse(decodedData);
                console.log(`🛒 Cart loaded from ${source}:`, cart);
            } catch (e) {
                console.error('Error parsing cart data', e);
                // Clear the corrupted data
                this.setCookie(this.cartCookieName, '', -1);
                localStorage.removeItem(this.cartCookieName);
                cart = [];
            }
        }

        // Fix: Ensure all items have a cartItemId
        let modified = false;
        cart = cart.map((item, index) => {
            if (!item.cartItemId) {
                console.warn(`⚠️ Item at index ${index} missing cartItemId, generating one.`);
                item.cartItemId = `${item.formId || 'unknown'}_${Date.now()}_${Math.floor(Math.random()*100000)}_${index}`;
                modified = true;
            }
            return item;
        });

        if (modified) {
            console.log('🛠️ Repaired cart items with missing IDs');
            // Save immediately to fix storage
            const savedData = JSON.stringify(cart);
            this.setCookie(this.cartCookieName, savedData, 30);
            localStorage.setItem(this.cartCookieName, savedData);
        }

        return cart;
    }

    saveCart() {
        const cartData = JSON.stringify(this.cart);
        this.setCookie(this.cartCookieName, cartData, 30);
        // Also save to localStorage for compatibility with cart.html
        localStorage.setItem(this.cartCookieName, cartData);
        console.log('💾 Cart saved to both cookies and localStorage:', this.cart);

        // Save to Firebase if user is logged in
        if (typeof firebase !== 'undefined' && firebase.auth) {
            const user = firebase.auth().currentUser;
            if (user) {
                this.saveToFirebase(user);
            }
        }
    }

    async saveToFirebase(user) {
        if (!user) return;
        try {
            const db = firebase.firestore();
            await db.collection('users').doc(user.uid).set({
                cart: this.cart,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log('☁️ Cart saved to Firebase for user:', user.uid);
        } catch (error) {
            console.error('❌ Error saving cart to Firebase:', error);
        }
    }

    async mergeWithFirebaseCart(user) {
        if (!user) return;
        try {
            const db = firebase.firestore();
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                const data = doc.data();
                const firebaseCart = data.cart || [];
                
                if (firebaseCart.length > 0) {
                    console.log('☁️ Found remote cart items:', firebaseCart.length);
                    
                    // Merge strategy: Combine unique items based on cartItemId
                    // If local cart has items that remote doesn't, add them.
                    // If remote has items local doesn't, add them.
                    
                    const localIds = new Set(this.cart.map(i => i.cartItemId));
                    const remoteIds = new Set(firebaseCart.map(i => i.cartItemId));
                    
                    // Add remote items not in local
                    const newFromRemote = firebaseCart.filter(i => !localIds.has(i.cartItemId));
                    
                    // Add local items not in remote (already in this.cart)
                    // ... actually, we want to keep all local items, effectively merging.
                    
                    // If we have local items that are NOT in remote, we should keep them (user added them while offline/logged out)
                    // Then we save the merged result back to Firebase.
                    
                    if (newFromRemote.length > 0) {
                        this.cart = [...this.cart, ...newFromRemote];
                        console.log(`☁️ Merged ${newFromRemote.length} items from Firebase into local cart.`);
                        
                        // Save merged state everywhere
                        this.saveCart(); 
                        await this.updateCartDisplay();
                    } else {
                        console.log('☁️ Local cart already has all remote items.');
                         // Ensure local cart is synced to Firebase in case local had extra items
                         if (this.cart.length > firebaseCart.length) {
                             this.saveToFirebase(user);
                         }
                    }
                } else if (this.cart.length > 0) {
                    // Remote has no cart, but local does. Push local to remote.
                    console.log('☁️ Remote cart empty, pushing local cart to Firebase.');
                    this.saveToFirebase(user);
                }
            } else if (this.cart.length > 0) {
                 // No user doc or no cart in it, but local cart exists. Create/Update user doc.
                 this.saveToFirebase(user);
            }
        } catch (error) {
            console.error('❌ Error merging cart from Firebase:', error);
        }
    }

    async addToCart(formId, formTitle, priceId, formData = null, countyName = '', defendantName = '', pdfName = null) {
        // Always add a new cart item with a unique cartItemId
        const cartItemId = `${formId}_${Date.now()}_${Math.floor(Math.random()*100000)}`;
        const cartItem = {
            cartItemId,
            formId,
            title: formTitle,
            priceId,
            formData,
            countyName,
            defendantName, // Store defendantName
            pdfName, // Store pdfName for PDF logic items
            originalFormId: formData?.originalFormId || formId, // Store original form ID for grouping
            portfolioId: formData?.portfolioId || null, // Store portfolio ID for grouping
            timestamp: Date.now()
        };
        
        console.log('🚨 PAGES CART MANAGER ADD TO CART CALLED!');
        console.log('🛒 Pages CartManager.addToCart called with:', {
            formId, formTitle, priceId, countyName, defendantName, pdfName, formData
        });
        console.log('🔍 FormData portfolioId:', formData?.portfolioId);
        console.log('🔍 FormData originalFormId:', formData?.originalFormId);
        console.log('📦 Adding cart item:', cartItem);
        console.log('📦 Cart item portfolioId field:', cartItem.portfolioId);
        console.log('🆔 Generated cartItemId:', cartItemId);
        
        // Debug: Check if portfolioId is being properly extracted
        if (formData && formData.portfolioId) {
            console.log('✅ [CART DEBUG] Portfolio ID found in formData:', formData.portfolioId);
        } else {
            console.log('⚠️ [CART DEBUG] No portfolio ID found in formData');
        }
        
        this.cart.push(cartItem);
        this.saveCart();
        await this.updateCartDisplay();
    }

    async removeFromCart(cartItemId) {
        console.log('🗑️ [CART DEBUG] Attempting to remove cartItemId:', cartItemId);
        console.log('🗑️ [CART DEBUG] Current cart items:', this.cart.map(item => ({ cartItemId: item.cartItemId, title: item.title })));
        
        const beforeCount = this.cart.length;
        this.cart = this.cart.filter(i => i.cartItemId !== cartItemId);
        const afterCount = this.cart.length;
        
        console.log('🗑️ [CART DEBUG] Cart items before removal:', beforeCount);
        console.log('🗑️ [CART DEBUG] Cart items after removal:', afterCount);
        
        if (beforeCount === afterCount) {
            console.error('❌ [CART DEBUG] No item was removed! cartItemId not found:', cartItemId);
        } else {
            console.log('✅ [CART DEBUG] Item successfully removed');
        }
        
        this.saveCart();
        await this.updateCartDisplay();
    }

    async getCartTotal() {
        let total = 0;
        for (const item of this.cart) {
            const priceInfo = await fetchStripePrice(item.priceId);
            if (priceInfo && priceInfo.unit_amount != null) {
                total += priceInfo.unit_amount / 100;
            }
        }
        return total;
    }

    getCartCount() {
        return this.cart.length;
    }

    async updateCartDisplay() {
        const itemsEl = document.getElementById('cart-items');
        const totalEl = document.getElementById('cart-total');
        const emptyEl = document.getElementById('empty-cart');
        const clearBtn = document.getElementById('clear-cart-btn');
        if (!itemsEl) return;

        // Show all cart items (no filtering)
        const filteredCart = this.cart;

        if (filteredCart.length === 0) {
            itemsEl.innerHTML = '';
            totalEl.style.display = 'none';
            emptyEl.style.display = 'block';
            if (clearBtn) clearBtn.style.display = 'none';
            return;
        }

        emptyEl.style.display = 'none';
        totalEl.style.display = 'block';
        if (clearBtn) clearBtn.style.display = 'block';

        let html = '';
        let total = 0;

        for (const item of filteredCart) {
            const priceInfo = await fetchStripePrice(item.priceId);
            let display = '...';
            if (priceInfo && priceInfo.unit_amount != null) {
                display = `$${(priceInfo.unit_amount / 100).toFixed(2)}`;
                total += priceInfo.unit_amount / 100;
            }
            // Capitalize defendant's name if present
            let defendantDisplay = '';
            if (item.defendantName) {
                const capName = String(item.defendantName)
                  .split(/\s+/)
                  .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                  .join(' ');
                defendantDisplay = `<div style='font-weight:bold;color:#e74c3c;'>Defendant: ${capName}</div>`;
            }
            html += `
                <div class="cart-item">
                    <div class="cart-item-content">
                        <div style="flex:1;display:flex;flex-direction:column;">
                            <div class="cart-item-title">${item.title}</div>
                            ${defendantDisplay}
                            ${item.countyName ? `<div class='cart-item-county' style='font-size:0.98em;color:#153a5b;margin-bottom:2px;'>${item.countyName}${item.countyName.toLowerCase().includes('county') ? '' : ' County'}</div>` : ''}
                            <div class="cart-item-price">${display}</div>
                        </div>
                        <button class="remove-item" onclick="cartManager.removeFromCart('${item.cartItemId}')">Remove</button>
                    </div>
                </div>
            `;
        }

        itemsEl.innerHTML = html;
        const totalAmount = document.getElementById('total-amount');
        if (totalAmount) totalAmount.textContent = `$${total.toFixed(2)}`;
    }

    async processCheckout() {
        if (this.cart.length === 0) {
            alert('Your cart is empty!');
            return;
        }
        try {
            await this.saveAllFormData();
            const total = await this.getCartTotal();
            
            // Debug: Check payload size
            const payload = { cartItems: this.cart, totalAmount: total };
            const payloadString = JSON.stringify(payload);
            const payloadSize = new Blob([payloadString]).size;
            console.log('📦 [CHECKOUT DEBUG] Payload size:', payloadSize, 'bytes (', (payloadSize / 1024).toFixed(2), 'KB)');
            console.log('📦 [CHECKOUT DEBUG] Cart items count:', this.cart.length);
            
            // Log cart item sizes
            this.cart.forEach((item, index) => {
                const itemSize = new Blob([JSON.stringify(item)]).size;
                console.log(`📦 [CHECKOUT DEBUG] Item ${index + 1} (${item.title}) size:`, itemSize, 'bytes');
                if (item.formData) {
                    const formDataSize = new Blob([JSON.stringify(item.formData)]).size;
                    console.log(`📦 [CHECKOUT DEBUG] Item ${index + 1} formData size:`, formDataSize, 'bytes');
                }
            });
            
            // If payload is too large, optimize it
            if (payloadSize > 100000) { // 100KB limit
                console.log('⚠️ [CHECKOUT DEBUG] Payload too large, optimizing...');
                const optimizedCartItems = this.cart.map(item => ({
                    cartItemId: item.cartItemId,
                    formId: item.formId,
                    title: item.title,
                    priceId: item.priceId,
                    countyName: item.countyName,
                    defendantName: item.defendantName,
                    pdfName: item.pdfName,
                    originalFormId: item.originalFormId,
                    portfolioId: item.portfolioId,
                    timestamp: item.timestamp
                    // Remove formData to reduce size - it's already saved to Firebase
                }));
                
                const optimizedPayload = { cartItems: optimizedCartItems, totalAmount: total };
                const optimizedPayloadString = JSON.stringify(optimizedPayload);
                const optimizedPayloadSize = new Blob([optimizedPayloadString]).size;
                console.log('📦 [CHECKOUT DEBUG] Optimized payload size:', optimizedPayloadSize, 'bytes (', (optimizedPayloadSize / 1024).toFixed(2), 'KB)');
                
                var res = await fetch('/create-cart-checkout-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: optimizedPayloadString,
                    mode: 'cors'
                });
            } else {
                var res = await fetch('/create-cart-checkout-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payloadString,
                    mode: 'cors'
                });
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.sessionId) {
                const stripe = Stripe('pk_test_51RcD0sFJeSRMFQ8XHBsZjqggnburcGm45kJWz7WAxZSjRklIxv9n8z6vNd3yofGwUbKn6C05GLhJ2QmD9fnQrc2R00wYqO0Dwq');
                stripe.redirectToCheckout({ sessionId: data.sessionId });
            } else {
                alert('Could not create payment session.');
            }
        } catch (e) {
            console.error('Checkout error', e);
            alert('Checkout failed: ' + e.message);
        }
    }

    async saveAllFormData() {
        if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) return;
        const user = firebase.auth().currentUser;
        if (!user) return;
        const db = firebase.firestore();
        for (const item of this.cart) {
            if (!item.formData) continue;
            try {
                await db.collection('users').doc(user.uid)
                    .collection('formAnswers').doc(item.formId)
                    .set(item.formData, { merge: true });
            } catch (e) {
                console.error('Save form data error', e);
            }
        }
    }

    async clearCart() {
        this.cart = [];
        this.saveCart();
        await this.updateCartDisplay();
    }

    setCookie(name, value, days) {
        const d = new Date();
        d.setTime(d.getTime() + days * 86400000);
        document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
    }

    getCookie(name) {
        const eq = name + '=';
        const parts = document.cookie.split(';');
        for (let c of parts) {
            while (c.charAt(0) === ' ') c = c.slice(1);
            if (c.indexOf(eq) === 0) return c.slice(eq.length);
        }
        return null;
    }

    async init() {
        await this.updateCartDisplay();
        
        // Listen for Auth changes to sync cart
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    console.log('👤 User signed in, syncing cart...', user.uid);
                    await this.mergeWithFirebaseCart(user);
                }
            });
        }

        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) checkoutBtn.addEventListener('click', () => this.processCheckout());

        const params = new URLSearchParams(window.location.search);
        if (params.get('payment') === 'success' && this.cart.length > 0) {
            console.log('🎉 [PAYMENT DEBUG] Payment success detected with cart items, processing...');
            this.showPaymentProcessingScreen();
            this.handlePaymentSuccess();
        } else if (params.get('payment') === 'success' && this.cart.length === 0) {
            console.log('⚠️ [PAYMENT DEBUG] Payment success detected but cart is empty, skipping processing');
        }
    }

    showPaymentProcessingScreen() {
        // Create loading overlay if it doesn't exist
        let loadingOverlay = document.getElementById('payment-processing-overlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'payment-processing-overlay';
            loadingOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.8);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                color: white;
                font-family: 'Montserrat', sans-serif;
            `;
            
            const loadingContent = document.createElement('div');
            loadingContent.style.cssText = `
                text-align: center;
                background-color: #2c3e50;
                padding: 40px;
                border-radius: 20px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                max-width: 400px;
                width: 90%;
            `;
            
            const spinner = document.createElement('div');
            spinner.style.cssText = `
                width: 50px;
                height: 50px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #2980b9;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px auto;
            `;
            
            const title = document.createElement('h2');
            title.textContent = 'Processing Payment...';
            title.style.cssText = `
                margin: 0 0 10px 0;
                color: #ffffff;
                font-size: 24px;
                font-weight: 700;
            `;
            
            const message = document.createElement('p');
            message.textContent = 'Please wait while we process your documents and save them to your account.';
            message.style.cssText = `
                margin: 0;
                color: #ecf0f1;
                font-size: 16px;
                line-height: 1.5;
            `;
            
            // Add CSS animation for spinner
            const style = document.createElement('style');
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
            
            loadingContent.appendChild(spinner);
            loadingContent.appendChild(title);
            loadingContent.appendChild(message);
            loadingOverlay.appendChild(loadingContent);
            document.body.appendChild(loadingOverlay);
        } else {
            loadingOverlay.style.display = 'flex';
        }
    }

    hidePaymentProcessingScreen() {
        const loadingOverlay = document.getElementById('payment-processing-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    async handlePaymentSuccess() {
        console.log('🎉 [PAYMENT DEBUG] Payment successful! Starting PDF processing...');
        console.log('🎉 [PAYMENT DEBUG] Cart items to process:', this.cart.length, this.cart);
        
        const processedItems = [];
        const failedItems = [];
        
        // Set a timeout to ensure loading screen doesn't get stuck
        const timeoutId = setTimeout(() => {
            console.log('⚠️ [PAYMENT DEBUG] Payment processing timeout reached, forcing completion...');
            this.hidePaymentProcessingScreen();
            alert('Payment processing is taking longer than expected. Please check your documents in a few moments.');
            window.history.replaceState({}, document.title, window.location.pathname);
            window.location.href = 'forms.html';
        }, 60000); // 60 second timeout
        
        try {
            for (const item of this.cart) {
                try {
                    console.log('🎉 [PAYMENT DEBUG] Processing item:', item.title, 'formId:', item.formId, 'portfolioId:', item.portfolioId);
                    await this.processFormPDF(item); // run unconditionally
                    processedItems.push(item);
                    console.log('✅ [PAYMENT DEBUG] Successfully processed:', item.title);
                } catch (err) {
                    console.error(`❌ [PAYMENT DEBUG] Failed to save ${item.formId}:`, err);
                    failedItems.push(item);
                    // Don't show alert for individual failures, just log them
                }
            }
            
            console.log('🎉 [PAYMENT DEBUG] PDF processing complete!');
            console.log('✅ [PAYMENT DEBUG] Successfully processed items:', processedItems.length, processedItems.map(item => item.title));
            console.log('❌ [PAYMENT DEBUG] Failed items:', failedItems.length, failedItems.map(item => item.title));
            
            // Remove portfolio entries after successful payment
            console.log('🗑️ [PAYMENT DEBUG] Starting portfolio removal process...');
            try {
                await this.removePortfolioEntries();
                console.log('🗑️ [PAYMENT DEBUG] Portfolio removal process completed');
            } catch (err) {
                console.error('❌ [PAYMENT DEBUG] Portfolio removal failed:', err);
            }
            
            await this.clearCart();
            
        } catch (err) {
            console.error('❌ [PAYMENT DEBUG] Critical error in payment processing:', err);
        } finally {
            // Clear the timeout since we're completing normally
            clearTimeout(timeoutId);
            
            // ALWAYS hide the loading screen, even if there were errors
            console.log('🔄 [PAYMENT DEBUG] Hiding loading screen...');
            this.hidePaymentProcessingScreen();
            
            // Show success message and redirect to forms page
            if (processedItems.length > 0) {
                alert('Payment successful! Your documents have been saved to My Documents.');
            } else {
                alert('Payment successful! However, there were issues saving some documents. Please contact support if needed.');
            }
            
            // Clear the URL parameters to prevent re-triggering on page reload
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Redirect to forms page
            window.location.href = 'forms.html';
        }
    }

    async removePortfolioEntries() {
        try {
            // Get the current user
            const user = firebase.auth().currentUser;
            if (!user) {
                console.log('❌ No user logged in, skipping portfolio removal');
                return;
            }

            const db = firebase.firestore();
            
            // Get unique portfolio IDs from cart items
            const portfolioIds = [...new Set(this.cart.map(item => item.portfolioId).filter(id => id))];
            
            console.log('🗑️ [PORTFOLIO DEBUG] Cart items:', this.cart.map(item => ({
                title: item.title,
                formId: item.formId,
                portfolioId: item.portfolioId,
                originalFormId: item.originalFormId
            })));
            console.log('🗑️ [PORTFOLIO DEBUG] Unique portfolio IDs to remove:', portfolioIds);
            
            if (portfolioIds.length === 0) {
                console.log('⚠️ [PORTFOLIO DEBUG] No portfolio IDs found in cart items');
                return;
            }
            
            // Debug: Let's see what's actually in the user's forms collection
            console.log('🔍 [PORTFOLIO DEBUG] Checking what forms exist in user collection...');
            const formsSnapshot = await db.collection('users').doc(user.uid).collection('forms').get();
            console.log('🔍 [PORTFOLIO DEBUG] Total forms in collection:', formsSnapshot.size);
            
            formsSnapshot.forEach(doc => {
                console.log('🔍 [PORTFOLIO DEBUG] Form document ID:', doc.id, 'Data:', doc.data());
            });
            
            // Remove each portfolio entry
            for (const portfolioId of portfolioIds) {
                try {
                    console.log('🗑️ [PORTFOLIO DEBUG] Attempting to remove portfolio entry with portfolio ID:', portfolioId);
                    
                    // Search for documents that contain this portfolio ID in their data
                    let documentToDelete = null;
                    formsSnapshot.forEach(doc => {
                        const data = doc.data();
                        console.log('🔍 [PORTFOLIO DEBUG] Checking document:', doc.id, 'portfolioId in data:', data.portfolioId, 'vs looking for:', portfolioId);
                        
                        // Check if this document has the portfolio ID we're looking for
                        if (data.portfolioId === portfolioId) {
                            console.log('🔍 [PORTFOLIO DEBUG] Found matching portfolio ID in document:', doc.id, 'with data:', data);
                            documentToDelete = doc;
                        }
                    });
                    
                    // If not found by portfolio ID, try to match by other fields from the cart item
                    if (!documentToDelete) {
                        console.log('🔍 [PORTFOLIO DEBUG] Portfolio ID not found in form data, trying to match by cart item details...');
                        const cartItem = this.cart.find(item => item.portfolioId === portfolioId);
                        if (cartItem) {
                            console.log('🔍 [PORTFOLIO DEBUG] Cart item details:', cartItem);
                            formsSnapshot.forEach(doc => {
                                const data = doc.data();
                                // Try to match by originalFormId, formId, or other identifying fields
                                if (data.originalFormId === cartItem.originalFormId || 
                                    data.formId === cartItem.formId ||
                                    doc.id === cartItem.originalFormId ||
                                    (data.name === cartItem.title && data.countyName === cartItem.countyName)) {
                                    console.log('🔍 [PORTFOLIO DEBUG] Found matching document by other fields:', doc.id, 'with data:', data);
                                    documentToDelete = doc;
                                }
                            });
                        }
                    }
                    
                    // Delete the document if found
                    if (documentToDelete) {
                        await documentToDelete.ref.delete();
                        console.log('✅ [PORTFOLIO DEBUG] Successfully removed portfolio entry:', documentToDelete.id, 'that contained portfolio ID:', portfolioId);
                    } else {
                        console.log('⚠️ [PORTFOLIO DEBUG] No document found containing portfolio ID:', portfolioId);
                        console.log('🔍 [PORTFOLIO DEBUG] Available document IDs:', formsSnapshot.docs.map(doc => doc.id));
                        console.log('🔍 [PORTFOLIO DEBUG] Available portfolio IDs in documents:', formsSnapshot.docs.map(doc => ({ id: doc.id, portfolioId: doc.data().portfolioId })));
                    }
                } catch (err) {
                    console.error('❌ [PORTFOLIO DEBUG] Failed to remove portfolio entry:', portfolioId, err);
                }
            }
            
            console.log('✅ [PORTFOLIO DEBUG] Portfolio removal process completed');
        } catch (err) {
            console.error('❌ [PORTFOLIO DEBUG] Error removing portfolio entries:', err);
        }
    }

    async processFormPDF(cartItem) {
        try {
            const formData = new FormData();
            if (cartItem.formData) {
                for (const k in cartItem.formData) formData.append(k, cartItem.formData[k]);
            }
            const base = cartItem.formId.replace(/\.pdf$/i, '');
            const res = await fetch('/edit_pdf?pdf=' + encodeURIComponent(base), {
                method: 'POST',
                body: formData,
                mode: 'cors'
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            const safeFormId = cartItem.formId.replace(/\W+/g, '_');
            const docId = `${Date.now()}_${safeFormId}`;
            a.download = `Edited_${cartItem.formId}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Email functionality temporarily disabled
            console.log('📧 Email functionality temporarily disabled - PDF will be saved to Firebase only');

            if (typeof firebase !== 'undefined' && firebase.auth && firebase.firestore && firebase.storage) {
                const user = firebase.auth().currentUser;
                if (user) {
                    const storage = firebase.storage();
                    const db = firebase.firestore();
                    const meta = { contentType: 'application/pdf', customMetadata: { uploadedBy: user.uid } };
                    const file = new File([blob], `${docId}.pdf`, { type: 'application/pdf' });
                    const ref = storage.ref().child(`users/${user.uid}/documents/${docId}.pdf`);
                    await ref.put(file, meta);
                    const downloadUrl = await ref.getDownloadURL();

                    // Fetch correct name, countyName, and defendantName from user's forms collection
                    let docName = cartItem.title || cartItem.formId;
                    let docCounty = null;
                    let docDefendant = null;
                    
                    console.log('🔍 [DEFENDANT DEBUG] Cart item defendantName:', cartItem.defendantName);
                    console.log('🔍 [DEFENDANT DEBUG] Cart item originalFormId:', cartItem.originalFormId);
                    console.log('🔍 [DEFENDANT DEBUG] Cart item formId:', cartItem.formId);
                    
                    try {
                        // For conditional PDFs, try to get data from the original form first
                        const formIdToCheck = cartItem.originalFormId || cartItem.formId;
                        console.log('🔍 [DEFENDANT DEBUG] Checking form document with ID:', formIdToCheck);
                        const formDoc = await db.collection('users').doc(user.uid).collection('forms').doc(formIdToCheck).get();
                        if (formDoc.exists) {
                            const formData = formDoc.data();
                            console.log('🔍 [DEFENDANT DEBUG] Form document data:', formData);
                            if (formData && formData.name) {
                                // For conditional PDFs, use the conditional PDF name but keep the main form context
                                if (cartItem.originalFormId && cartItem.originalFormId !== cartItem.formId) {
                                    docName = cartItem.title || cartItem.formId; // Use the conditional PDF name
                                } else {
                                    docName = formData.name; // Use the main form name
                                }
                            }
                            if (formData && formData.countyName) docCounty = formData.countyName;
                            if (formData && formData.defendantName) docDefendant = formData.defendantName;
                            console.log('🔍 [DEFENDANT DEBUG] Defendant name from form data:', docDefendant);
                        } else {
                            console.log('⚠️ [DEFENDANT DEBUG] Form document does not exist:', formIdToCheck);
                        }
                    } catch (e) {
                        // fallback: use cartItem data
                        console.log('⚠️ [DEFENDANT DEBUG] Could not fetch form data from Firebase, using cart item data:', e);
                    }
                    
                    // Fallback to cart item data if Firebase data is not available
                    if (!docCounty && cartItem.countyName) docCounty = cartItem.countyName;
                    if (!docDefendant && cartItem.defendantName) {
                        docDefendant = cartItem.defendantName;
                        console.log('🔍 [DEFENDANT DEBUG] Using defendant name from cart item:', docDefendant);
                    }
                    
                    console.log('🔍 [DEFENDANT DEBUG] Final defendant name for document:', docDefendant);

                    const documentData = {
                        name: docName,
                        formId: cartItem.formId,
                        originalFormId: cartItem.originalFormId || cartItem.formId, // Track the original form that generated this document
                        portfolioId: cartItem.portfolioId || null, // Track the portfolio ID for grouping
                        countyName: docCounty || null,
                        defendantName: docDefendant || null,
                        purchaseDate: firebase.firestore.FieldValue.serverTimestamp(),
                        downloadUrl
                    };
                    
                    console.log('💾 [PAYMENT DEBUG] Saving document to Firebase:', documentData);
                    
                    await db.collection('users').doc(user.uid)
                        .collection('documents').doc(docId).set(documentData);
                    
                    console.log('✅ [PAYMENT DEBUG] Document saved successfully:', {
                        formId: cartItem.formId,
                        title: cartItem.title,
                        portfolioId: cartItem.portfolioId,
                        originalFormId: cartItem.originalFormId,
                        docId: docId
                    });
                }
            }
        } catch (e) {
            console.error(`PDF process error for ${cartItem.formId}`, e);
        }
    }
}

let cartManager;

document.addEventListener('DOMContentLoaded', async () => {
    cartManager = new CartManager();
    await cartManager.updateCartDisplay();
});

function addToCart(formId, formTitle, priceId, formData, countyName, defendantName, pdfName) {
    console.log('🌐 Pages addToCart called with:', {
        formId, formTitle, priceId, countyName, defendantName, pdfName
    });
    
    if (cartManager) {
        console.log('🛒 Calling CartManager.addToCart from Pages...');
        cartManager.addToCart(formId, formTitle, priceId, formData, countyName, defendantName, pdfName);
    } else {
        console.error('❌ CartManager not available in Pages!');
    }
}

function getCartCount() {
    return cartManager ? cartManager.getCartCount() : 0;
}

function clearCart() {
    if (cartManager) cartManager.clearCart();
}
