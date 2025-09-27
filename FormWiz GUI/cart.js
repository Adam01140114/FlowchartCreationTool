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
        
        if (!cartData) {
            console.log('🛒 No cart data found in cookies or localStorage');
            return [];
        }
        
        try {
            // Decode URL-encoded data if needed
            const decodedData = cartData.startsWith('%') ? decodeURIComponent(cartData) : cartData;
            const cart = JSON.parse(decodedData);
            console.log(`🛒 Cart loaded from ${source}:`, cart);
            return cart;
        } catch (e) {
            console.error('Error parsing cart data', e);
            // Clear the corrupted data
            this.setCookie(this.cartCookieName, '', -1);
            localStorage.removeItem(this.cartCookieName);
            return [];
        }
    }

    saveCart() {
        const cartData = JSON.stringify(this.cart);
        this.setCookie(this.cartCookieName, cartData, 30);
        // Also save to localStorage for compatibility with cart.html
        localStorage.setItem(this.cartCookieName, cartData);
        console.log('💾 Cart saved to both cookies and localStorage:', this.cart);
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
            const res = await fetch('/create-cart-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cartItems: this.cart, totalAmount: total }),
                mode: 'cors'
            });
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
        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) checkoutBtn.addEventListener('click', () => this.processCheckout());

        const params = new URLSearchParams(window.location.search);
        if (params.get('payment') === 'success') this.handlePaymentSuccess();
    }

    async handlePaymentSuccess() {
        console.log('🎉 [PAYMENT DEBUG] Payment successful! Starting PDF processing...');
        console.log('🎉 [PAYMENT DEBUG] Cart items to process:', this.cart.length, this.cart);
        
        const processedItems = [];
        const failedItems = [];
        
        for (const item of this.cart) {
            try {
                console.log('🎉 [PAYMENT DEBUG] Processing item:', item.title, 'formId:', item.formId, 'portfolioId:', item.portfolioId);
                await this.processFormPDF(item); // run unconditionally
                processedItems.push(item);
                console.log('✅ [PAYMENT DEBUG] Successfully processed:', item.title);
            } catch (err) {
                console.error(`❌ [PAYMENT DEBUG] Failed to save ${item.formId}:`, err);
                failedItems.push(item);
                alert(`Could not save ${item.title || item.formId} to your account.`);
            }
        }
        
        console.log('🎉 [PAYMENT DEBUG] PDF processing complete!');
        console.log('✅ [PAYMENT DEBUG] Successfully processed items:', processedItems.length, processedItems.map(item => item.title));
        console.log('❌ [PAYMENT DEBUG] Failed items:', failedItems.length, failedItems.map(item => item.title));
        
        // Remove portfolio entries after successful payment
        await this.removePortfolioEntries();
        
        await this.clearCart();
        
        // Show debug alert with processing results (commented out for production)
        /*
        const debugInfo = `🎉 Payment Debug Results:
        
✅ Successfully processed ${processedItems.length} PDF(s):
${processedItems.map(item => `- ${item.title} (${item.formId}) - Portfolio: ${item.portfolioId || 'N/A'}`).join('\n')}

${failedItems.length > 0 ? `❌ Failed to process ${failedItems.length} PDF(s):
${failedItems.map(item => `- ${item.title} (${item.formId})`).join('\n')}` : '✅ All PDFs processed successfully!'}

📁 PDFs with the same portfolio ID will be grouped together in My Documents.
📥 Clicking download will open all PDFs associated with that form.

Forms page requested.`;
        
        alert(debugInfo);
        */
        
        // Show success message and redirect to forms.html
        alert('Payment successful! Your documents have been saved to My Documents.');
        window.location.href = 'forms.html';
    }

    async removePortfolioEntries() {
        try {
            // Get the current user
            const user = firebase.auth().currentUser;
            if (!user) {
                console.log('No user logged in, skipping portfolio removal');
                return;
            }

            const db = firebase.firestore();
            
            // Get unique portfolio IDs from cart items
            const portfolioIds = [...new Set(this.cart.map(item => item.portfolioId).filter(id => id))];
            
            console.log('🗑️ Removing portfolio entries for portfolioIds:', portfolioIds);
            
            // Remove each portfolio entry
            for (const portfolioId of portfolioIds) {
                try {
                    await db.collection('users').doc(user.uid)
                        .collection('forms').doc(portfolioId).delete();
                    console.log('✅ Removed portfolio entry:', portfolioId);
                } catch (err) {
                    console.error('❌ Failed to remove portfolio entry:', portfolioId, err);
                }
            }
        } catch (err) {
            console.error('❌ Error removing portfolio entries:', err);
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

            let userEmail = null;
            if (typeof firebase !== 'undefined' && firebase.auth) {
                const user = firebase.auth().currentUser;
                if (user && user.email) userEmail = user.email;
            }
            if (!userEmail) userEmail = prompt('Enter your email to receive a copy of your PDF');
            if (userEmail) {
                try {
                    console.log('📧 Attempting to email PDF to:', userEmail);
                    const emailData = new FormData();
                    emailData.append('to', userEmail);
                    emailData.append('filename', `Edited_${cartItem.formId}`);
                    emailData.append('subject', 'Your Completed Form from FormWiz');
                    emailData.append('text', 'Attached is your completed PDF form from FormWiz.');
                    emailData.append('pdf', blob, `Edited_${cartItem.formId}`);
                    
                    const emailResponse = await fetch('/email-pdf', { method: 'POST', body: emailData, mode: 'cors' });
                    if (!emailResponse.ok) {
                        console.error('❌ Email failed with status:', emailResponse.status, emailResponse.statusText);
                        const errorText = await emailResponse.text();
                        console.error('❌ Email error details:', errorText);
                    } else {
                        console.log('✅ Email sent successfully');
                    }
                } catch (emailError) {
                    console.error('❌ Email error:', emailError);
                }
            }

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
                    try {
                        // For conditional PDFs, try to get data from the original form first
                        const formIdToCheck = cartItem.originalFormId || cartItem.formId;
                        const formDoc = await db.collection('users').doc(user.uid).collection('forms').doc(formIdToCheck).get();
                        if (formDoc.exists) {
                            const formData = formDoc.data();
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
                        }
                    } catch (e) {
                        // fallback: use cartItem data
                        console.log('⚠️ Could not fetch form data from Firebase, using cart item data');
                    }
                    
                    // Fallback to cart item data if Firebase data is not available
                    if (!docCounty && cartItem.countyName) docCounty = cartItem.countyName;
                    if (!docDefendant && cartItem.defendantName) docDefendant = cartItem.defendantName;

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
