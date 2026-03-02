<script>
(function () {

  const MAX_CHARS = 12;
  let typingTimer = null;

  // Motif characters from button clicks
  const motifChars = new Set(['m','i','c','p','9','r','7','H','A','✡','♡']);

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }
  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]
    );
  }

  function countChars(str) {
    return [...str].length;
  }

  function getEditable() {
    return qs('.eng-bubble-input');
  }
  function getLipText() {
    return qs('.eng-lip-text');
  }

  // 🔥 FIXED: Extract tokens correctly
  function getTokensFromEditable(editable) {
    const tokens = [];
    editable.childNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('Emotifontfamily')) {
        // This is a MOTIF span (from clicking motif button)
        const ch = node.textContent.trim();
        if (ch) tokens.push({type:'motif', ch});
      } else if (node.nodeType === Node.TEXT_NODE) {
        // This is TYPED TEXT
        const text = node.nodeValue || '';
        [...text].forEach(ch => {
          if (ch !== '\n' && ch !== '\r') {
            tokens.push({type:'char', ch});
          }
        });
      }
    });
    return tokens;
  }

  function updateEmptyClass(editable) {
    const tokens = getTokensFromEditable(editable);
    editable.classList.toggle('empty', tokens.length === 0);
  }

  // 🔥 FIXED: Place caret in text node context
  function placeCaretAtEnd(el) {
    el.focus();
    
    // If empty, add a zero-width space to position cursor
    if (el.childNodes.length === 0) {
      el.appendChild(document.createTextNode('\u200B'));
    }

    const range = document.createRange();
    const sel = window.getSelection();
    
    // Get last child
    const lastChild = el.lastChild;
    
    if (lastChild) {
      if (lastChild.nodeType === Node.TEXT_NODE) {
        // Last child is text node - position at end
        range.setStart(lastChild, lastChild.length);
        range.collapse(true);
      } else {
        // Last child is element (motif span) - create text node after it
        const textNode = document.createTextNode('\u200B');
        el.appendChild(textNode);
        range.setStart(textNode, 1);
        range.collapse(true);
      }
    }
    
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // 🔥 FIXED: Render and ensure cursor in text context
  function renderEditableFromTokens(editable, tokens) {
    // Limit to MAX_CHARS
    let allowed = [];
    let charCount = 0;
    for (const t of tokens) {
      if (charCount < MAX_CHARS) {
        allowed.push(t);
        charCount++;
      }
    }

    // Save cursor position info
    const hadFocus = document.activeElement === editable;

    // Clear and rebuild
    editable.innerHTML = '';
    
    allowed.forEach((t, index) => {
      if (t.type === 'motif') {
        // Create motif span
        const span = document.createElement('span');
        span.className = 'Emotifontfamily';
        span.textContent = t.ch;
        editable.appendChild(span);
        
        // 🔥 CRITICAL: Add text node after motif to position cursor
        if (index === allowed.length - 1) {
          // This is the last token and it's a motif
          // Add zero-width space so cursor can be positioned after it
          editable.appendChild(document.createTextNode('\u200B'));
        }
      } else {
        // Regular typed text
        editable.appendChild(document.createTextNode(t.ch.toUpperCase()));
      }
    });

    // If completely empty, add zero-width space
    if (editable.childNodes.length === 0) {
      editable.appendChild(document.createTextNode('\u200B'));
    }

    updateEmptyClass(editable);
    
    if (hadFocus) {
      placeCaretAtEnd(editable);
    }
    
    updatePreview(editable);
  }

  function updatePreview(editable) {
    const lipText = getLipText();
    if (!lipText) return;

    const tokens = getTokensFromEditable(editable);
    let html = '';
    tokens.forEach(t => {
      if (t.type === 'motif') {
        html += `<span class="Emotifontfamily">${escapeHtml(t.ch)}</span>`;
      } else {
        html += `<span class="plain-char">${escapeHtml(t.ch.toUpperCase())}</span>`;
      }
    });
    lipText.innerHTML = html || '&nbsp;';
  }

  // 🔥 FIXED: Clean up input and rebuild
  function sanitizeEditable(editable) {
    const tokens = getTokensFromEditable(editable);
    
    // Uppercase all typed characters
    const cleaned = tokens.map(t => {
      if (t.type === 'char') {
        return {type: 'char', ch: t.ch.toUpperCase()};
      }
      return t;
    });
    
    renderEditableFromTokens(editable, cleaned);
  }

  // 🔥 FIXED: Insert motif at end
  function insertMotifAtCaret(editable, ch) {
    const tokens = getTokensFromEditable(editable);
    
    // Add motif at the end
    tokens.push({type:'motif', ch});
    
    renderEditableFromTokens(editable, tokens);
  }

  /* ===== EXTRACT DATA FOR SHOPIFY ===== */
  
  function getFullEngravingText() {
    const editable = getEditable();
    if (!editable) return '';

    let result = '';
    editable.childNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('Emotifontfamily')) {
        result += node.textContent.trim();
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue.replace(/\u200B/g, ''); // Remove zero-width spaces
        result += text.toUpperCase();
      }
    });
    return result.trim();
  }

  function getTextOnly() {
    const editable = getEditable();
    if (!editable) return '';

    let result = '';
    editable.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue.replace(/\u200B/g, '');
        result += text.toUpperCase();
      }
    });
    return result.trim();
  }

  function getMotifs() {
    const editable = getEditable();
    if (!editable) return [];

    const motifs = [];
    editable.childNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('Emotifontfamily')) {
        const motifChar = node.textContent.trim();
        if (motifChar) motifs.push(motifChar);
      }
    });
    return motifs;
  }

  function getShadeName() {
    const shadeText = qs('#engrave-modal-backdrop .eng-shade-pill span:last-child');
    return shadeText ? shadeText.textContent.trim() : 'N/A';
  }

  /* ================= EVENT HANDLERS ================= */

  document.addEventListener('click', function (e) {

    /* OPEN POPUP */
    if (e.target.closest('#engrave-link-wrap button')) {
      qs('#engrave-modal-backdrop').style.display = 'flex';
      
      // Initialize editable when modal opens
      setTimeout(() => {
        const editable = getEditable();
        if (editable) {
          editable.innerHTML = '';
          editable.appendChild(document.createTextNode('\u200B'));
          updateEmptyClass(editable);
          editable.focus();
        }
      }, 100);
    }

    /* CLOSE / CANCEL */
    if (e.target.closest('.eng-close, .btn-outline')) {
      qs('#engrave-modal-backdrop').style.display = 'none';
    }

    /* FONT SELECTION */
    const fontTab = e.target.closest('.eng-font-tab');
    if (fontTab) {
      qsa('.eng-font-tab').forEach(t=>t.classList.remove('is-selected'));
      fontTab.classList.add('is-selected');

      const editable = getEditable();
      const lipText = getLipText();
      if (!editable || !lipText) return;

      // Remove old font classes
      editable.className = editable.className.replace(/font-\S+/g,'').trim();
      lipText.className = lipText.className.replace(/font-\S+/g,'').trim();
      
      // Add eng-bubble-input back if removed
      if (!editable.classList.contains('eng-bubble-input')) {
        editable.classList.add('eng-bubble-input');
      }

      const txt = fontTab.textContent.toLowerCase();
      if (txt.includes('futura')) {
        editable.classList.add('font-futura');
        lipText.classList.add('font-futura');
      } else if (txt.includes('rockwell')) {
        editable.classList.add('font-rockwell');
        lipText.classList.add('font-rockwell');
      } else if (txt.includes('avant')) {
        editable.classList.add('font-avant');
        lipText.classList.add('font-avant');
      }

      sanitizeEditable(editable);
    }

    /* MOTIF CLICK */
    const motif = e.target.closest('.emojiMotif');
    if (motif) {
      qsa('.emojiMotif').forEach(m=>m.classList.remove('is-selected'));
      motif.classList.add('is-selected');

      const editable = getEditable();
      if (editable) {
        const ch = motif.textContent.trim();
        if (ch) {
          insertMotifAtCaret(editable, ch);
        }
      }
    }

    /* ADD BUTTON */
    if (e.target.closest('.btn-primary')) {
      
      const form = qs('form[action*="/cart/add"]') || 
                   qs('#product-form') || 
                   qs('form.product-form') ||
                   qs('form[data-product-form]');
      
      if (!form) {
        console.error('Product form not found!');
        alert('Unable to add to cart. Please try again.');
        return;
      }

      const fullText = getFullEngravingText();
      const textOnly = getTextOnly();
      const motifs = getMotifs();
      const font = qs('.eng-font-tab.is-selected')?.innerText.trim() || 'Default';
      const shade = getShadeName();

      if (!fullText) {
        alert('Please enter engraving text or select motifs');
        return;
      }

      console.log('📝 Engraving Data:');
      console.log('  Full Text:', fullText);
      console.log('  Text Only:', textOnly);
      console.log('  Motifs:', motifs);
      console.log('  Font:', font);
      console.log('  Shade:', shade);

      // Remove old properties
      qsa('[data-engraving]', form).forEach(el => el.remove());

      function addProp(label, value) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = `properties[${label}]`;
        input.value = value;
        input.setAttribute('data-engraving', 'true');
        form.appendChild(input);
      }

      addProp('Engraving', 'Yes');
      addProp('Engraving Text', fullText);
      addProp('Text Only', textOnly);
      addProp('Engraving Font', font);
      addProp('Shade', shade);
      
      if (motifs.length > 0) {
        addProp('Motifs', motifs.join(','));
      }
      
      addProp('Engraving Fee', '100');

      qs('#engrave-modal-backdrop').style.display = 'none';
      
      console.log('✅ Submitting form');
      form.submit();
    }
  });

  /* 🔥 FIXED: Input handler */
  document.addEventListener('input', function (e) {
    const editable = e.target.closest('.eng-bubble-input');
    if (!editable) return;

    // Clean up any motif characters that were typed
    // (should not happen, but as safety measure)
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      sanitizeEditable(editable);
    }, 150);
  });

  /* Prevent Enter key */
  document.addEventListener('keydown', function (e) {
    if (e.target.closest('.eng-bubble-input') && e.key === 'Enter') {
      e.preventDefault();
      return false;
    }
  });

  /* 🔥 FIXED: Handle paste */
  document.addEventListener('paste', function(e) {
    const editable = e.target.closest('.eng-bubble-input');
    if (!editable) return;
    
    e.preventDefault();
    
    // Get plain text only
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const cleaned = text.replace(/[\n\r]/g, '').toUpperCase();
    
    // Insert as plain text
    document.execCommand('insertText', false, cleaned);
  });

})();
</script>