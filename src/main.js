/* Žolíky / Rummy Game Logic
   - 2 Decks (108 cards)
   - Opening Meld: 36 Points (multiple melds allowed)
   - Melding starts Round 3
*/

const SUITS = ['♥', '♦', '♣', '♠'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const JOKER = 'JK';

class Card {
    constructor(suit, rank, id) {
        this.suit = suit;
        this.rank = rank;
        this.id = id;
        this.isJoker = (suit === JOKER);
        this.selected = false;
    }

    getValue(isSequence = false) {
        if (this.isJoker) return 0; // Joker value is contextual
        if (['J', 'Q', 'K', 'A'].includes(this.rank)) return 10;
        return parseInt(this.rank);
    }

    getOrder() {
        if (this.isJoker) return 99;
        return RANKS.indexOf(this.rank);
    }

    getColor() {
        return (this.suit === '♥' || this.suit === '♦') ? 'red' : 'black';
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.init();
    }

    init() {
        this.cards = [];
        let idCounter = 0;
        // Two standard decks
        for (let d = 0; d < 2; d++) {
            for (let s of SUITS) {
                for (let r of RANKS) {
                    this.cards.push(new Card(s, r, idCounter++));
                }
            }
            // 2 Jokers per deck
            this.cards.push(new Card(JOKER, 'Joker', idCounter++));
            this.cards.push(new Card(JOKER, 'Joker', idCounter++));
        }
        this.shuffle();
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    draw() {
        return this.cards.pop();
    }
}

class Game {
    constructor() {
        this.deck = null;
        this.pHand = [];
        this.cHand = [];
        this.melds = []; 
        this.discardPile = [];
        
        this.turn = 'human';
        this.phase = 'draw';
        this.hasOpened = { human: false, cpu: false };
        this.round = 1;
        
        // New State Variables for Rules
        this.turnMelds = []; // Track indices of melds added this turn (for cancellation)
        this.turnPoints = 0; // Track points accumulated this turn
        this.drawnFromDiscardId = null; // Track if user picked from discard
        this.discardCardUsed = false; // Track if that card was melded
        
        this.ui = {
            stock: document.getElementById('stock-pile'),
            discard: document.getElementById('discard-pile'),
            pHand: document.getElementById('player-hand'),
            cHand: document.getElementById('cpu-hand'),
            table: document.getElementById('table-zone'),
            status: document.getElementById('status-text'),
            score: document.getElementById('score-text'),
            btnMeld: document.getElementById('btn-meld'),
            btnCancel: document.getElementById('btn-cancel'),
            btnDiscard: document.getElementById('btn-discard'),
            modal: document.getElementById('modal'),
            modalMsg: document.getElementById('modal-msg')
        };
    }

    init() {
        this.deck = new Deck();
        this.pHand = [];
        this.cHand = [];
        this.melds = [];
        this.discardPile = [];
        this.hasOpened = { human: false, cpu: false };
        this.round = 1;
        this.resetTurnState();

        // Deal 12 cards each
        for(let i=0; i<12; i++) {
            this.pHand.push(this.deck.draw());
            this.cHand.push(this.deck.draw());
        }

        this.sortHandLogic(this.pHand);
        this.sortHandLogic(this.cHand);

        this.discardPile.push(this.deck.draw());

        this.turn = 'human';
        this.phase = 'draw';
        
        this.render();
        this.updateStatus("Your turn. Draw a card.");
    }

    resetTurnState() {
        this.turnMelds = [];
        this.turnPoints = 0;
        this.drawnFromDiscardId = null;
        this.discardCardUsed = false;
    }

    // --- Core Logic ---

    humanDraw(source) {
        if (this.turn !== 'human' || this.phase !== 'draw') return;

        let card;
        if (source === 'stock') {
            card = this.deck.draw();
            if (!card) {
                if (this.discardPile.length > 0) {
                    const top = this.discardPile.pop();
                    this.deck.cards = [...this.discardPile];
                    this.deck.shuffle();
                    this.discardPile = [top];
                    card = this.deck.draw();
                } else {
                    this.endGame("Draw - Deck Empty");
                    return;
                }
            }
        } else {
            // Draw from discard
            if (this.discardPile.length === 0) return;
            card = this.discardPile.pop();
            this.drawnFromDiscardId = card.id; // Track this specific card
        }

        this.pHand.push(card);
        this.sortHandLogic(this.pHand); 

        this.render();

        const targetEl = this.ui.pHand.querySelector(`[data-id="${card.id}"]`);

        if (targetEl) {
            targetEl.style.opacity = '0';
            this.animateDraw(card, source, targetEl, () => {
                targetEl.style.opacity = '1';
                this.phase = 'action';
                let msg = "Meld cards or Discard to end turn.";
                if (this.drawnFromDiscardId) msg = "You drew from discard. You MUST meld this card!";
                this.updateStatus(msg);
            });
        } else {
            this.phase = 'action';
            this.render();
        }
    }

    animateDraw(card, sourceName, targetEl, onComplete) {
        const sourceEl = document.getElementById(sourceName === 'stock' ? 'stock-pile' : 'discard-pile');
        
        if (!sourceEl || !targetEl) {
            onComplete();
            return;
        }

        const flyer = document.createElement('div');
        flyer.className = `card ${card.getColor()} flying-card`;
        flyer.innerHTML = this.renderCardInner(card);

        const sRect = sourceEl.getBoundingClientRect();
        flyer.style.left = sRect.left + 'px';
        flyer.style.top = sRect.top + 'px';
        flyer.style.width = sRect.width + 'px';
        flyer.style.height = sRect.height + 'px';

        document.body.appendChild(flyer);
        flyer.offsetHeight;

        const tRect = targetEl.getBoundingClientRect();
        flyer.style.left = tRect.left + 'px';
        flyer.style.top = tRect.top + 'px';
        flyer.style.transform = 'scale(1.0)';

        setTimeout(() => {
            document.body.removeChild(flyer);
            onComplete();
        }, 500);
    }

    humanMeld() {
        if (this.turn !== 'human' || this.phase !== 'action') return;
        
        // Rule: Round 3 Requirement
        if (this.round < 3) {
            alert(`You cannot meld until Round 3. Current Round: ${this.round}`);
            return;
        }

        const selected = this.pHand.filter(c => c.selected);
        if (selected.length < 3) {
            alert("A meld must have at least 3 cards.");
            return;
        }

        const validation = this.validateMeld(selected);
        
        if (validation.valid) {
            // Check if Discard Card is used
            if (this.drawnFromDiscardId) {
                const usedDiscard = selected.some(c => c.id === this.drawnFromDiscardId);
                if (usedDiscard) this.discardCardUsed = true;
            }

            // Add to board
            this.melds.push(selected);
            this.turnMelds.push(this.melds.length - 1); // Track index for cancelling
            this.turnPoints += validation.points; // Track points for opening

            this.pHand = this.pHand.filter(c => !c.selected);
            
            // Check Win
            if (this.pHand.length === 0) {
                // If they go out, opening rules technically met if score is valid or they are finishing
                if (!this.hasOpened.human && this.turnPoints < 36) {
                    // Edge case: Going out without opening? Allowed if total > 36.
                    // For simplicity, enforce 36.
                    alert(`Opening total must be 36+. Current: ${this.turnPoints}`);
                    this.cancelMelds(); // Force reset
                    return;
                }
                this.endGame("Human Wins!");
                return;
            }

            this.render();
            
            if (!this.hasOpened.human) {
                this.updateStatus(`Pending Opening Points: ${this.turnPoints}/36.`);
            }

        } else {
            alert("Invalid Meld. Must be a Set (same rank) or Run (sequence same suit).");
        }
    }
    
    cancelMelds() {
        if (this.turnMelds.length === 0) return;
        
        // Reverse order to remove from end
        for (let i = this.turnMelds.length - 1; i >= 0; i--) {
            const meldIdx = this.turnMelds[i];
            const meldCards = this.melds[meldIdx];
            
            // Return to hand
            this.pHand.push(...meldCards);
            
            // Mark as null in melds array (to keep indices valid if we had complex logic, 
            // but here we can just splice if we are careful. 
            // Simplest: remove from melds array. Since we push to end, we can pop.)
            this.melds.splice(meldIdx, 1);
        }
        
        this.turnMelds = [];
        this.turnPoints = 0;
        this.discardCardUsed = false; // Reset usage
        
        this.sortHandLogic(this.pHand);
        this.pHand.forEach(c => c.selected = false);
        this.render();
        this.updateStatus("Melds cancelled. Cards returned to hand.");
    }

    humanDiscard() {
        if (this.turn !== 'human' || this.phase !== 'action') return;

        // Rule: Verify Opening Score
        if (!this.hasOpened.human) {
            if (this.turnMelds.length > 0) {
                if (this.turnPoints < 36) {
                    alert(`Opening melds must sum to 36 points. You have ${this.turnPoints}. Please add more melds or Cancel.`);
                    return;
                }
                // Success - Opened
                this.hasOpened.human = true;
                this.turnMelds = []; // Commit them
            }
        }

        // Rule: Verify Discard Pickup Usage
        if (this.drawnFromDiscardId && !this.discardCardUsed) {
            alert("You picked up from the discard pile. You MUST use that card in a meld before discarding.");
            return;
        }

        const selected = this.pHand.filter(c => c.selected);
        if (selected.length !== 1) {
            alert("Select exactly one card to discard.");
            return;
        }

        const card = selected[0];
        card.selected = false;
        
        // Prevent discarding the card you just picked from discard?
        // Rule check: "must use in meld". If they used it, they don't have it.
        // If they didn't use it, we blocked above. 
        // So this is safe.

        this.pHand = this.pHand.filter(c => c.id !== card.id);
        this.discardPile.push(card);

        if (this.pHand.length === 0) {
            this.endGame("Human Wins!");
            return;
        }

        this.turn = 'cpu';
        this.phase = 'draw';
        this.resetTurnState(); // Clear tracking for next turn
        this.render();
        this.updateStatus("CPU is thinking...");
        
        setTimeout(() => this.cpuTurn(), 1000);
    }

    addToMeld(meldIndex) {
        if (this.turn !== 'human' || this.phase !== 'action') return;
        
        // Cannot add to melds if you haven't opened OR if you are currently opening (pending state)
        // If pending opening, you should only create new melds usually. 
        // But if you opened PREVIOUS turns, you can add.
        if (!this.hasOpened.human) {
            alert("You must open (play melds totaling 36+ points) before adding to existing melds.");
            return;
        }
        
        // If we are currently opening (turnMelds > 0), allows adding to *opponent's* melds?
        // Usually you can't add to opponent until you open. 
        // Logic handles above.

        const selected = this.pHand.filter(c => c.selected);
        if (selected.length === 0) return;

        const targetMeld = [...this.melds[meldIndex]];
        const newCandidates = [...targetMeld, ...selected];
        
        const validation = this.validateMeld(newCandidates);
        if (validation.valid) {
            
            // Check discard usage
            if (this.drawnFromDiscardId) {
                const usedDiscard = selected.some(c => c.id === this.drawnFromDiscardId);
                if (usedDiscard) this.discardCardUsed = true;
            }

            this.melds[meldIndex] = newCandidates;
            this.pHand = this.pHand.filter(c => !c.selected); 
            this.render();
            
            if (this.pHand.length === 0) this.endGame("Human Wins!");
        } else {
            alert("Cannot add these cards to that meld.");
        }
    }

    sortHand() {
        this.sortHandLogic(this.pHand);
        this.render();
    }

    sortHandLogic(hand) {
        hand.sort((a, b) => {
            if (a.suit === b.suit) return a.getOrder() - b.getOrder();
            return a.suit.localeCompare(b.suit);
        });
    }

    // --- Validation Logic ---

    validateMeld(cards) {
        const jokerCount = cards.filter(c => c.isJoker).length;
        const nonJokers = cards.filter(c => !c.isJoker);
        
        if (nonJokers.length === 0) return { valid: false, points: 0 }; 
        
        // 1. Check for Set
        const firstRank = nonJokers[0].rank;
        const isSet = nonJokers.every(c => c.rank === firstRank);
        
        if (isSet && cards.length >= 3) {
            let val = nonJokers[0].getValue();
            return { valid: true, points: val * cards.length, type: 'set' };
        }

        // 2. Check for Run
        const firstSuit = nonJokers[0].suit;
        const isSameSuit = nonJokers.every(c => c.suit === firstSuit);
        
        if (isSameSuit && cards.length >= 3) {
            const sorted = [...nonJokers].sort((a, b) => a.getOrder() - b.getOrder());
            
            let gaps = 0;
            for (let i = 0; i < sorted.length - 1; i++) {
                const diff = sorted[i+1].getOrder() - sorted[i].getOrder();
                if (diff < 1) return { valid: false }; 
                gaps += (diff - 1);
            }
            
            if (gaps <= jokerCount) {
                let sum = nonJokers.reduce((acc, c) => acc + c.getValue(), 0);
                sum += (jokerCount * 10);
                return { valid: true, points: sum, type: 'run' };
            }
        }

        return { valid: false, points: 0 };
    }

    // --- CPU Logic ---

    cpuTurn() {
        let card = this.deck.draw();
        if(!card) {
             if(this.discardPile.length > 1) {
                 this.deck.cards = this.discardPile.slice(0, this.discardPile.length-1);
                 this.discardPile = [this.discardPile[this.discardPile.length-1]];
                 this.deck.shuffle();
                 card = this.deck.draw();
             } else {
                 this.endGame("Draw - Deck Empty");
                 return;
             }
        }
        if(card) this.cHand.push(card);

        this.sortHandLogic(this.cHand);

        // Simple CPU AI
        let played = false;
        
        // Only meld if Round >= 3
        if (this.round >= 3) {
            const rankGroups = {};
            this.cHand.forEach(c => {
                if(c.isJoker) return;
                if(!rankGroups[c.rank]) rankGroups[c.rank] = [];
                rankGroups[c.rank].push(c);
            });

            for (let r in rankGroups) {
                if (rankGroups[r].length >= 3) {
                    const meldCards = rankGroups[r].slice(0, 3);
                    const val = this.validateMeld(meldCards);
                    
                    // Opening Check (36 points)
                    if (!this.hasOpened.cpu) {
                        if (val.points >= 36) {
                            this.hasOpened.cpu = true;
                        } else {
                            continue;
                        }
                    }

                    this.melds.push(meldCards);
                    this.cHand = this.cHand.filter(c => !meldCards.includes(c));
                    played = true;
                    break;
                }
            }
        }

        // Discard
        if (this.cHand.length > 0) {
            const discardIndex = Math.floor(Math.random() * this.cHand.length);
            const disc = this.cHand.splice(discardIndex, 1)[0];
            this.discardPile.push(disc);
        }

        if (this.cHand.length === 0) {
            this.endGame("CPU Wins!");
            return;
        }

        // End of full round (Human + CPU played)
        // Note: Logic says Round increments after both played? 
        // Or simply every time CPU finishes, it's a new opportunity for Human.
        // Let's increment round here.
        this.round++; 

        this.turn = 'human';
        this.phase = 'draw';
        this.render();
        this.updateStatus(`Round ${this.round}. Your turn.`);
    }

    // --- Rendering ---

    render() {
        // Stats
        this.ui.score.innerText = `Rd: ${this.round} | Pts: ${this.turnPoints}/36`;

        // Discard Pile
        if (this.discardPile.length > 0) {
            const top = this.discardPile[this.discardPile.length - 1];
            this.ui.discard.innerHTML = this.renderCardInner(top);
            this.ui.discard.className = `card ${top.getColor()}`;
            this.ui.discard.style.opacity = "1";
        } else {
            this.ui.discard.innerHTML = "";
            this.ui.discard.className = "card";
            this.ui.discard.style.opacity = "0.5";
        }

        // Player Hand
        this.ui.pHand.innerHTML = '';
        this.pHand.forEach(c => {
            const el = document.createElement('div');
            el.className = `card ${c.getColor()} ${c.selected ? 'selected' : ''}`;
            el.dataset.id = c.id; 
            el.innerHTML = this.renderCardInner(c);
            el.onclick = () => this.toggleSelect(c);
            this.ui.pHand.appendChild(el);
        });

        // CPU Hand
        this.ui.cHand.innerHTML = '';
        this.cHand.forEach(c => {
            const el = document.createElement('div');
            el.className = `card card-back`; 
            this.ui.cHand.appendChild(el);
        });

        // Table
        this.ui.table.innerHTML = '';
        this.melds.forEach((meld, idx) => {
            const grp = document.createElement('div');
            // Check if this meld is "pending" (in current turn, not yet opened)
            const isPending = this.turnMelds.includes(idx) && !this.hasOpened.human && this.turn === 'human';
            
            grp.className = `meld-group ${isPending ? 'pending' : ''}`;
            grp.onclick = () => this.addToMeld(idx);
            
            meld.forEach(c => {
                const el = document.createElement('div');
                el.className = `card ${c.getColor()}`;
                el.innerHTML = this.renderCardInner(c);
                grp.appendChild(el);
            });
            this.ui.table.appendChild(grp);
        });

        // Buttons
        const hasSelected = this.pHand.some(c => c.selected);
        this.ui.btnMeld.disabled = !hasSelected;
        this.ui.btnDiscard.disabled = (this.pHand.filter(c => c.selected).length !== 1);
        
        // Cancel Button
        if (this.turnMelds.length > 0 && !this.hasOpened.human) {
            this.ui.btnCancel.style.display = 'block';
        } else {
            this.ui.btnCancel.style.display = 'none';
        }
    }

    renderCardInner(c) {
        if (c.isJoker) {
            return `
                <div class="card-top"><span>🤡</span></div>
                <div class="card-center">🃏</div>
                <div class="card-bottom"><span>🤡</span></div>
            `;
        }
        return `
            <div class="card-top"><span>${c.rank}</span><span>${c.suit}</span></div>
            <div class="card-center">${c.suit}</div>
            <div class="card-bottom"><span>${c.rank}</span><span>${c.suit}</span></div>
        `;
    }

    toggleSelect(card) {
        if (this.turn !== 'human' || this.phase !== 'action') return;
        card.selected = !card.selected;
        this.render();
    }

    updateStatus(msg) {
        this.ui.status.innerText = msg;
    }

    endGame(winner) {
        this.ui.modalMsg.innerText = winner;
        this.ui.modal.style.display = 'flex';
    }
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// Start
const game = new Game();
// Attach to window so HTML inline click handlers work
window.game = game;
window.closeModal = closeModal;

game.init();
