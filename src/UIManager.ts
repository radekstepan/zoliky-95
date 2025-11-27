import { GameState } from "./GameState";
import { ICard } from "./types";
import { SoundManager } from "./core/SoundManager";
import { validateMeld, organizeMeld } from "./core/rules";
import { Card } from "./core/Card"; // Import Card class for cloning

export class UIManager {
    private game: GameState;
    public sound: SoundManager;

    private ui = {
        stock: document.getElementById('stock-pile')!,
        discard: document.getElementById('discard-pile')!,
        pHand: document.getElementById('player-hand')!,
        cHand: document.getElementById('cpu-hand')!,
        table: document.getElementById('table-zone')!,
        status: document.getElementById('status-text')!,
        score: document.getElementById('score-text')!,
        btnMeld: document.getElementById('btn-meld') as HTMLButtonElement,
        btnDiscard: document.getElementById('btn-discard') as HTMLButtonElement,
        menuUndo: document.getElementById('menu-undo')!,
        modal: document.getElementById('modal')!,
        modalMsg: document.getElementById('modal-msg')!,
        alertModal: document.getElementById('alert-modal')!,
        alertTitle: document.getElementById('alert-title')!,
        alertMsg: document.getElementById('alert-msg')!,
        alertIcon: document.getElementById('alert-icon')!,
        debugModal: document.getElementById('debug-modal')!
    };

    // Drag State
    private dragSourceIndex: number | null = null;
    
    // Debug State
    public debugSwapCardId: number | null = null;
    
    // Confetti State: No interval needed for CSS animation approach

    constructor(game: GameState) {
        this.game = game;
        this.sound = new SoundManager();
    }

    private cloneCard(c: ICard): Card {
        const clone = new Card(c.suit, c.rank, c.id);
        clone.selected = c.selected;
        if (c.representation) {
            clone.representation = { ...c.representation };
        }
        return clone;
    }

    public render() {
        const { round, turnPoints, discardPile, pHand, cHand, melds, turnMelds, turnAdditions, turn, bottomCard, phase, drawnFromDiscardId, hasOpened } = this.game;

        this.ui.score.innerText = `Rd: ${round} | Pts: ${turnPoints}`;

        const isMyTurn = turn === 'human';
        const isDrawPhase = isMyTurn && phase === 'draw';
        const isActionPhase = isMyTurn && phase === 'action';
        const selected = pHand.filter(c => c.selected);
        const isDebug = new URLSearchParams(window.location.search).has('debug');

        // --- Valid Move Calculations ---
        let isMeldValid = false;
        let validTargets: number[] = [];

        if (isActionPhase && selected.length > 0) {
            // Check New Meld Validity
            if (selected.length >= 3) {
                const res = validateMeld(selected);
                if (res.valid) isMeldValid = true;
            }
            // Check Add-to-Meld Validity
            // Allow if opened OR if the target meld was created this turn
            melds.forEach((m, i) => {
                const isTurnMeld = turnMelds.includes(i);
                if (this.game.isOpeningConditionMet() || isTurnMeld) {
                    // CLONE cards for speculative check to avoid mutating hand cards (Joker representation)
                    const candidates = [...m, ...selected].map(c => this.cloneCard(c));
                    const organized = organizeMeld(candidates);
                    if (validateMeld(organized).valid) {
                        validTargets.push(i);
                    }
                }
            });
        }

        // --- Stock Pile ---
        this.ui.stock.className = `card card-back ${isDrawPhase ? 'interactive' : ''}`;

        // --- Bottom Card ---
        if (bottomCard) {
            this.ui.stock.style.position = 'relative';
            this.ui.stock.style.zIndex = '10';

            if (isDrawPhase) {
                this.ui.stock.style.cursor = 'pointer';
            } else {
                this.ui.stock.style.cursor = 'default';
            }

            let bEl = document.getElementById('bottom-card-display');
            if (!bEl) {
                bEl = document.createElement('div');
                bEl.id = 'bottom-card-display';
                bEl.style.position = 'absolute';
                bEl.style.top = '18px';
                bEl.style.left = '0';
                bEl.style.zIndex = '1';
                bEl.style.transform = 'translateY(35px)';
                this.ui.stock.parentElement?.appendChild(bEl);
            }

            if (bEl) {
                bEl.innerHTML = this.renderCardInner(bottomCard);
                bEl.className = `card ${bottomCard.getColor()}`;
                
                // User requirement: Active only in turn 3+ AND before opened
                const canTakeJolly = isDrawPhase && round >= 3 && pHand.length === 12 && !hasOpened.human;

                if (canTakeJolly) {
                    bEl.style.cursor = 'pointer';
                    bEl.classList.add('interactive');
                    bEl.onclick = () => (window as any).game.attemptJolly();
                    bEl.title = "Jolly Hand (Click to take)";
                } else {
                    bEl.style.cursor = 'default';
                    bEl.classList.remove('interactive');
                    bEl.onclick = null;
                    if (round < 3) bEl.title = "Jolly Hand (Available Round 3)";
                    else if (hasOpened.human) bEl.title = "Cannot take Jolly Hand after opening";
                    else if (pHand.length !== 12) bEl.title = "Need 12 cards to take Jolly Hand";
                }
                bEl.style.boxShadow = "1px 1px 3px rgba(0,0,0,0.5)";
            }
        } else {
            const bEl = document.getElementById('bottom-card-display');
            if (bEl) bEl.remove();
        }

        // --- Discard Pile ---
        if (discardPile.length > 0) {
            const top = discardPile[discardPile.length - 1];

            // Check for winning discard condition
            const isHumanWin = pHand.length === 0 && turn === 'human'; 
            const isCpuWin = cHand.length === 0 && turn === 'cpu';
            const isWinningCard = isHumanWin || isCpuWin;

            if (isWinningCard) {
                // Winning State: Show previous card (if any) and overlay winner face down
                let baseCardHtml = "";
                let baseCardClass = "card";
                
                if (discardPile.length >= 2) {
                    const prev = discardPile[discardPile.length - 2];
                    baseCardHtml = this.renderCardInner(prev);
                    baseCardClass = `card ${prev.getColor()}`;
                } else {
                    // Empty underneath
                    baseCardClass = "card";
                    this.ui.discard.style.opacity = "0.5";
                }

                this.ui.discard.innerHTML = baseCardHtml;
                this.ui.discard.className = baseCardClass;
                this.ui.discard.style.opacity = "1";

                // Overlay the winning card
                const winCard = document.createElement('div');
                winCard.className = "card card-back winning-discard";
                winCard.style.position = "absolute";
                winCard.style.top = "0";
                winCard.style.left = "0";
                // Note: .winning-discard in CSS handles the transform offset
                
                this.ui.discard.appendChild(winCard);
            } else {
                // Normal State
                this.ui.discard.innerHTML = this.renderCardInner(top);
                const canDrawDiscard = isDrawPhase && round >= 3;
                const discardInteractive = canDrawDiscard ? 'interactive' : '';
                this.ui.discard.className = `card ${top.getColor()} ${discardInteractive}`;
                this.ui.discard.style.opacity = "1";
            }
        } else {
            this.ui.discard.innerHTML = "";
            this.ui.discard.className = "card";
            this.ui.discard.style.opacity = "0.5";
        }

        // --- Player Hand ---
        this.ui.pHand.innerHTML = '';
        pHand.forEach((c, idx) => {
            const el = document.createElement('div');
            const handInteractive = isMyTurn ? 'interactive' : '';
            el.className = `card ${c.getColor()} ${c.selected ? 'selected' : ''} ${handInteractive}`;
            el.dataset.id = c.id.toString();
            el.innerHTML = this.renderCardInner(c);

            if (isMyTurn) {
                // Drag Events
                el.draggable = true;
                el.ondragstart = (e) => this.handleDragStart(e, idx);
                el.ondragover = (e) => this.handleDragOver(e, el);
                el.ondragleave = (e) => this.handleDragLeave(e, el);
                el.ondrop = (e) => this.handleDrop(e, idx);
                
                el.onclick = (e) => {
                    if (isDebug && e.shiftKey) {
                        this.handleDebugSwap(c);
                        return;
                    }
                    this.handleCardClick(c);
                };
            }

            this.ui.pHand.appendChild(el);
        });

        const oldBtn = document.getElementById('btn-jolly');
        if (oldBtn) oldBtn.remove();

        // --- CPU Hand ---
        this.ui.cHand.innerHTML = '';
        cHand.forEach(() => {
            const el = document.createElement('div');
            el.className = `card card-back`;
            this.ui.cHand.appendChild(el);
        });

        // --- Table ---
        this.ui.table.innerHTML = '';
        melds.forEach((meld, idx) => {
            const grp = document.createElement('div');
            const isPending = turnMelds.includes(idx) && !this.game.hasOpened.human && turn === 'human';
            const isValidTarget = validTargets.includes(idx);
            
            const isTurnMeld = turnMelds.includes(idx);
            // Determine if meld should show pointer cursor (card selected + (opened OR is turn meld))
            const showPointer = isActionPhase && selected.length > 0 && (this.game.isOpeningConditionMet() || isTurnMeld);
            const interactiveClass = showPointer ? 'meld-interactive' : '';

            grp.className = `meld-group ${isPending ? 'pending' : ''} ${isValidTarget ? 'valid-target' : ''} ${interactiveClass}`;
            
            if (isActionPhase) {
                grp.onclick = () => this.handleMeldClick(idx);
            } else {
                grp.onclick = null;
            }

            meld.forEach(c => {
                const el = document.createElement('div');
                el.className = `card ${c.getColor()}`;
                el.dataset.id = c.id.toString();
                el.innerHTML = this.renderCardInner(c);
                grp.appendChild(el);
            });
            this.ui.table.appendChild(grp);
        });

        this.ui.btnMeld.disabled = selected.length < 1;
        // Highlight Meld Button if valid
        if (isMeldValid) {
            this.ui.btnMeld.classList.add('valid-move');
        } else {
            this.ui.btnMeld.classList.remove('valid-move');
        }

        this.ui.btnDiscard.disabled = selected.length !== 1;

        // --- Cancel / Undo Logic ---
        const canUndoDraw = isActionPhase && drawnFromDiscardId && turnMelds.length === 0 && turnAdditions.length === 0;
        const canCancelMelds = (turnMelds.length > 0 || turnAdditions.length > 0) && !this.game.hasOpened.human;

        if (canUndoDraw) {
            this.ui.menuUndo.classList.remove('disabled');
            this.ui.menuUndo.onclick = () => (window as any).game.undoDraw();
        } else if (canCancelMelds) {
            this.ui.menuUndo.classList.remove('disabled');
            this.ui.menuUndo.onclick = () => (window as any).game.cancelMelds();
        } else {
            this.ui.menuUndo.classList.add('disabled');
            this.ui.menuUndo.onclick = null;
        }
    }

    private handleDebugSwap(card: ICard) {
        this.debugSwapCardId = card.id;

        // Update dropdowns to match current card if possible
        const rankEl = document.getElementById('combo-rank');
        const rankText = document.getElementById('combo-rank-text');
        const suitEl = document.getElementById('combo-suit');
        const suitText = document.getElementById('combo-suit-text');

        if (rankEl && rankText) {
            // Map 'J' to 'Jack' etc for display
            const displayMap: Record<string, string> = { 'J': 'Jack', 'Q': 'Queen', 'K': 'King', 'A': 'Ace', 'Joker': 'Joker' };
            const val = card.rank;
            rankEl.dataset.value = val;
            rankText.innerText = displayMap[val] || val;
        }

        if (suitEl && suitText) {
            const suitMap: Record<string, string> = { '♥': 'Hearts (♥)', '♦': 'Diamonds (♦)', '♣': 'Clubs (♣)', '♠': 'Spades (♠)', 'JK': 'Joker (JK)' };
            const val = card.suit;
            suitEl.dataset.value = val;
            suitText.innerText = suitMap[val] || val;
        }

        this.ui.debugModal.style.display = 'flex';
    }

    public closeDebugModal() {
        this.ui.debugModal.style.display = 'none';
        this.debugSwapCardId = null;
        // Close dropdowns if open
        const rList = document.getElementById('combo-rank-list');
        const sList = document.getElementById('combo-suit-list');
        if (rList) rList.style.display = 'none';
        if (sList) sList.style.display = 'none';
    }

    public updateStatus(msg: string) {
        this.ui.status.innerText = msg;
    }

    public showWinModal(msg: string) {
        this.sound.playWin();
        this.ui.modalMsg.innerText = msg;
        this.ui.modal.style.display = 'flex';
        this.startConfetti();
    }

    public closeWinModal() {
        this.ui.modal.style.display = 'none';
        this.stopConfetti();
    }

    private startConfetti() {
        const colors = [
            '#ffffff', '#c0c0c0', '#808080', '#000000',
            '#ff0000', '#800000', '#ffff00', '#800000',
            '#00ff00', '#008000', '#00ffff', '#008080',
            '#0000ff', '#000080', '#ff00ff', '#800080'
        ];

        // Create 100 confetti pieces
        for (let i = 0; i < 100; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            
            // Random properties
            const color = colors[Math.floor(Math.random() * colors.length)];
            const left = Math.random() * 100; // vw
            const duration = 2 + Math.random() * 3; // 2-5s
            const delay = Math.random() * 2; // 0-2s delay
            
            confetti.style.backgroundColor = color;
            confetti.style.left = `${left}vw`;
            confetti.style.animation = `confetti-fall ${duration}s linear ${delay}s infinite`;
            
            document.body.appendChild(confetti);
        }
    }

    private stopConfetti() {
        const confettis = document.querySelectorAll('.confetti');
        confettis.forEach(el => el.remove());
    }

    public showAlert(msg: string, title: string = 'Alert', icon: string = '⚠️', isHtml: boolean = false) {
        this.sound.playError();
        this.ui.alertTitle.innerText = title;
        if (isHtml) {
            this.ui.alertMsg.innerHTML = msg;
        } else {
            this.ui.alertMsg.innerText = msg;
        }
        this.ui.alertIcon.innerText = icon;
        this.ui.alertModal.style.display = 'flex';
    }

    public closeAlert() {
        this.ui.alertModal.style.display = 'none';
    }

    public getCardElement(id: number): HTMLElement | null {
        // Search globally for the card ID
        return document.querySelector(`[data-id="${id}"]`);
    }

    public captureCardPositions(ids: number[]): Record<number, DOMRect> {
        const rects: Record<number, DOMRect> = {};
        ids.forEach(id => {
            const el = this.getCardElement(id);
            if (el) rects[id] = el.getBoundingClientRect();
        });
        return rects;
    }

    public getMeldElement(index: number): HTMLElement | null {
        const groups = this.ui.table.querySelectorAll('.meld-group');
        return groups[index] as HTMLElement;
    }

    private renderCardInner(c: ICard): string {
        if (c.isJoker) {
            const rep = c.representation;
            const jesterSvg = `
            <svg viewBox="0 0 100 100" style="width: 100%; height: 100%;">
                <path d="M50,50 C30,75 10,75 10,50 C10,25 30,25 50,50 C70,75 90,75 90,50 C90,25 70,25 50,50 Z" 
                      fill="none" stroke="#800080" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;

            const smallJester = `<span style="font-size: 12px; color: #800080;">JOKER</span>`;

            const topContent = rep ? `<span>${rep.rank}</span><span>${rep.suit}</span>` : smallJester;
            const botContent = rep ? `<span>${rep.rank}</span><span>${rep.suit}</span>` : smallJester;
            const style = rep ? 'color: gray; opacity: 0.7;' : '';

            return `
                <div class="card-top" style="${style}">${topContent}</div>
                <div class="card-center" style="width: 60%; height: 60%;">${jesterSvg}</div>
                <div class="card-bottom" style="${style}">${botContent}</div>
            `;
        }
        return `
            <div class="card-top"><span>${c.rank}</span><span>${c.suit}</span></div>
            <div class="card-center">${c.suit}</div>
            <div class="card-bottom"><span>${c.rank}</span><span>${c.suit}</span></div>
        `;
    }

    private handleCardClick(card: ICard) {
        if (this.game.turn !== 'human') return;

        // Toggle selection
        card.selected = !card.selected;
        this.sound.playClick();
        this.render();
    }

    // --- Drag and Drop Handlers ---
    private handleDragStart(e: DragEvent, idx: number) {
        this.dragSourceIndex = idx;
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', idx.toString());
        }
        const target = e.target as HTMLElement;
        setTimeout(() => target.classList.add('dragging'), 0);
    }

    private handleDragOver(e: DragEvent, el: HTMLElement) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        el.classList.add('drag-over');
    }

    // Fixed: Renamed parameter to ignore unused
    private handleDragLeave(_: DragEvent, el: HTMLElement) {
        el.classList.remove('drag-over');
    }

    private handleDrop(e: DragEvent, toIdx: number) {
        e.preventDefault();
        e.stopPropagation();

        const fromIdx = this.dragSourceIndex;
        if (fromIdx !== null && fromIdx !== toIdx) {
            this.game.reorderHand(fromIdx, toIdx);
            this.sound.playSnap();
        }
        this.dragSourceIndex = null;
        this.render();
    }

    private handleMeldClick(meldIdx: number) {
        if (this.game.phase !== 'action') return;
        const selected = this.game.pHand.filter(c => c.selected);
        if (selected.length === 0) return;

        // Capture Rects for animation
        const startRects: Record<number, DOMRect> = {};
        selected.forEach(c => {
            const el = this.getCardElement(c.id);
            if (el) startRects[c.id] = el.getBoundingClientRect();
        });

        if (selected.length === 1) {
            const res = this.game.attemptJokerSwap(meldIdx, selected[0].id);
            if (res.success) {
                this.sound.playSnap();
                this.render();
                return;
            }
        }

        const res = this.game.addToExistingMeld(meldIdx, selected);
        if (res.success) {
            this.render();
            this.animateToMeld(selected, startRects, meldIdx, () => {
                if (res.winner) this.showWinModal(`${res.winner} Wins!`);
            });
        } else {
            this.showAlert(res.msg || "Invalid Move");
        }
    }

    public animateDraw(card: ICard, source: 'stock' | 'discard', onComplete: () => void) {
        this.sound.playDraw();
        const sourceEl = source === 'stock' ? this.ui.stock : this.ui.discard;
        const targetEl = this.ui.pHand.querySelector(`[data-id="${card.id}"]`) as HTMLElement;

        if (!sourceEl || !targetEl) {
            onComplete();
            return;
        }
        this.animateTransition(targetEl, sourceEl.getBoundingClientRect(), targetEl.getBoundingClientRect(), onComplete);
    }

    public animateTransition(targetEl: HTMLElement, startRect: DOMRect, endRect: DOMRect, onComplete: () => void) {
        targetEl.style.opacity = '0';

        const flyer = document.createElement('div');
        flyer.className = targetEl.className;
        flyer.innerHTML = targetEl.innerHTML;
        flyer.classList.add('flying-card');
        flyer.classList.remove('selected', 'dragging', 'drag-over');

        // Initial Pos
        flyer.style.left = startRect.left + 'px';
        flyer.style.top = startRect.top + 'px';
        flyer.style.width = startRect.width + 'px';
        flyer.style.height = startRect.height + 'px';
        flyer.style.transform = 'scale(1.0)';

        document.body.appendChild(flyer);
        // Force reflow
        flyer.offsetHeight;

        // Animate to End
        flyer.style.left = endRect.left + 'px';
        flyer.style.top = endRect.top + 'px';
        flyer.style.width = endRect.width + 'px';
        flyer.style.height = endRect.height + 'px';

        setTimeout(() => {
            if (document.body.contains(flyer)) document.body.removeChild(flyer);
            targetEl.style.opacity = '1';
            onComplete();
        }, 500);
    }

    public animateReturnToHand(ids: number[], startRects: Record<number, DOMRect>, onComplete: () => void) {
        this.sound.playSnap();
        let count = 0;
        let completed = 0;

        ids.forEach(id => {
            const startRect = startRects[id];
            // Find element in hand (already rendered there)
            const targetEl = this.ui.pHand.querySelector(`[data-id="${id}"]`) as HTMLElement;
            if (startRect && targetEl) {
                count++;
                this.animateTransition(targetEl, startRect, targetEl.getBoundingClientRect(), () => {
                    completed++;
                    if (completed === count) onComplete();
                });
            }
        });

        if (count === 0) onComplete();
    }

    public animateUndoDraw(startRect: DOMRect, onComplete: () => void) {
         this.sound.playSnap();
         // The card is now in the discard pile logically and visually (after render).
         const discardEl = this.ui.discard; 
         
         if (discardEl) {
             const flyer = document.createElement('div');
             flyer.className = discardEl.className;
             flyer.classList.add('flying-card');
             flyer.innerHTML = discardEl.innerHTML;
             
             // Start at Hand position
             flyer.style.left = startRect.left + 'px';
             flyer.style.top = startRect.top + 'px';
             flyer.style.width = startRect.width + 'px';
             flyer.style.height = startRect.height + 'px';
             
             document.body.appendChild(flyer);
             flyer.offsetHeight;
             
             const endRect = discardEl.getBoundingClientRect();
             
             flyer.style.left = endRect.left + 'px';
             flyer.style.top = endRect.top + 'px';
             
             setTimeout(() => {
                if (document.body.contains(flyer)) document.body.removeChild(flyer);
                onComplete();
             }, 500);
         } else {
             onComplete();
         }
    }

    public animateToMeld(cards: ICard[], startRects: Record<number, DOMRect>, meldIndex: number, onComplete: () => void) {
        this.sound.playSnap();
        const meldEl = this.getMeldElement(meldIndex);
        if (!meldEl) { onComplete(); return; }

        let count = 0;
        let completed = 0;

        cards.forEach(c => {
            const startRect = startRects[c.id];
            // Find element in new meld by ID
            const targetEl = meldEl.querySelector(`[data-id="${c.id}"]`) as HTMLElement;
            if (startRect && targetEl) {
                count++;
                this.animateTransition(targetEl, startRect, targetEl.getBoundingClientRect(), () => {
                    completed++;
                    if (completed === count) onComplete();
                });
            }
        });

        if (count === 0) onComplete();
    }

    public animateDiscard(card: ICard, startRect: DOMRect, onComplete: () => void, isWinning: boolean = false) {
        this.sound.playSnap();

        const flyer = document.createElement('div');
        
        // If winning, animate face down (dramatic finish)
        if (isWinning) {
            flyer.className = `card card-back flying-card`;
            flyer.innerHTML = '';
        } else {
            flyer.className = `card ${card.getColor()} flying-card`;
            flyer.innerHTML = this.renderCardInner(card);
        }

        flyer.style.left = startRect.left + 'px';
        flyer.style.top = startRect.top + 'px';
        flyer.style.width = startRect.width + 'px';
        flyer.style.height = startRect.height + 'px';

        document.body.appendChild(flyer);
        flyer.offsetHeight;

        let endRect: DOMRect;
        
        // Determine destination rect
        // If winning, try to target the offset winning-card element specifically
        if (isWinning) {
            const winEl = this.ui.discard.querySelector('.winning-discard');
            if (winEl) {
                endRect = winEl.getBoundingClientRect();
                (winEl as HTMLElement).style.opacity = '0'; // Hide destination temporarily
            } else {
                endRect = this.ui.discard.getBoundingClientRect();
            }
        } else {
            endRect = this.ui.discard.getBoundingClientRect();
        }

        flyer.style.left = endRect.left + 'px';
        flyer.style.top = endRect.top + 'px';

        setTimeout(() => {
            if (document.body.contains(flyer)) document.body.removeChild(flyer);
            
            // Restore visibility of winning card if we hid it
            if (isWinning) {
                const winEl = this.ui.discard.querySelector('.winning-discard');
                if (winEl) (winEl as HTMLElement).style.opacity = '1';
            }
            
            onComplete();
        }, 500);
    }

    public animateCpuDiscard(card: ICard, onComplete: () => void, isWinning: boolean = false) {
        this.sound.playSnap();

        // Get the position of the last CPU hand card (rightmost)
        const cpuCards = this.ui.cHand.querySelectorAll('.card');
        const lastCard = cpuCards[cpuCards.length - 1] as HTMLElement;
        const startRect = lastCard ? lastCard.getBoundingClientRect() : this.ui.cHand.getBoundingClientRect();

        const flyer = document.createElement('div');
        
        if (isWinning) {
            flyer.className = `card card-back flying-card`;
            flyer.innerHTML = '';
        } else {
            flyer.className = `card ${card.getColor()} flying-card`;
            flyer.innerHTML = this.renderCardInner(card);
        }

        flyer.style.left = startRect.left + 'px';
        flyer.style.top = startRect.top + 'px';
        flyer.style.width = startRect.width + 'px';
        flyer.style.height = startRect.height + 'px';

        document.body.appendChild(flyer);
        flyer.offsetHeight;

        let endRect: DOMRect;
        
        if (isWinning) {
            const winEl = this.ui.discard.querySelector('.winning-discard');
            if (winEl) {
                endRect = winEl.getBoundingClientRect();
                (winEl as HTMLElement).style.opacity = '0';
            } else {
                endRect = this.ui.discard.getBoundingClientRect();
            }
        } else {
            endRect = this.ui.discard.getBoundingClientRect();
        }

        flyer.style.left = endRect.left + 'px';
        flyer.style.top = endRect.top + 'px';

        setTimeout(() => {
            if (document.body.contains(flyer)) document.body.removeChild(flyer);
             if (isWinning) {
                const winEl = this.ui.discard.querySelector('.winning-discard');
                if (winEl) (winEl as HTMLElement).style.opacity = '1';
            }
            onComplete();
        }, 500);
    }

    public animateCpuDraw(source: 'stock' | 'discard', onComplete: () => void) {
        this.sound.playDraw();

        const sourceEl = source === 'stock' ? this.ui.stock : this.ui.discard;
        const startRect = sourceEl.getBoundingClientRect();

        // Target Calculation: Land *after* the current last card.
        const cpuCards = this.ui.cHand.querySelectorAll('.card');
        const lastCard = cpuCards[cpuCards.length - 1] as HTMLElement;
        let leftPos, topPos;

        if (lastCard) {
            const lastRect = lastCard.getBoundingClientRect();
            // With fixed CPU alignment (left-aligned), the next card goes to the right.
            // Cards overlap by 25px, so effective width is ~45px. 
            // But we want it to land "at the end", overlapping the current last card.
            // Visually the last card has margin-right: 0. 
            // The new card will make the previous one have margin-right -25px.
            // So the new card should land at `lastRect.left + 45px`.
            leftPos = lastRect.left + 45; 
            topPos = lastRect.top;
        } else {
            // Empty hand (rare)
            const handRect = this.ui.cHand.getBoundingClientRect();
            leftPos = handRect.left;
            topPos = handRect.top;
        }

        const flyer = document.createElement('div');

        if (source === 'stock') {
            flyer.className = 'card card-back flying-card';
        } else {
            const topDiscard = this.game.discardPile[this.game.discardPile.length - 1];
            if (topDiscard) {
                flyer.className = `card ${topDiscard.getColor()} flying-card`;
                flyer.innerHTML = this.renderCardInner(topDiscard);
            } else {
                flyer.className = 'card card-back flying-card';
            }
        }

        flyer.style.left = startRect.left + 'px';
        flyer.style.top = startRect.top + 'px';
        flyer.style.width = startRect.width + 'px';
        flyer.style.height = startRect.height + 'px';

        document.body.appendChild(flyer);
        flyer.offsetHeight;

        flyer.style.left = leftPos + 'px';
        flyer.style.top = topPos + 'px';

        setTimeout(() => {
            if (document.body.contains(flyer)) document.body.removeChild(flyer);
            onComplete();
        }, 500);
    }

    public animateCpuMelds(melds: ICard[][], onComplete: () => void) {
        if (!melds || melds.length === 0) {
            onComplete();
            return;
        }

        let meldIndex = 0;
        
        const playNextMeld = () => {
            if (meldIndex >= melds.length) {
                onComplete();
                return;
            }

            const currentMeld = melds[meldIndex];
            this.sound.playSnap();
            
            let cardsDone = 0;
            currentMeld.forEach(c => {
                 const el = this.ui.table.querySelector(`[data-id="${c.id}"]`) as HTMLElement;
                 if (el) {
                     const cpuRect = this.ui.cHand.getBoundingClientRect();
                     // Use approx center of CPU hand as origin
                     const startRect = {
                         left: cpuRect.left + cpuRect.width / 2 - 35,
                         top: cpuRect.top,
                         width: 70,
                         height: 100,
                         right: 0, bottom: 0, x: 0, y: 0, toJSON: () => {}
                     } as DOMRect;
                     
                     this.animateTransition(el, startRect, el.getBoundingClientRect(), () => {
                         cardsDone++;
                         if (cardsDone === currentMeld.length) {
                             setTimeout(() => {
                                 meldIndex++;
                                 playNextMeld();
                             }, 200); 
                         }
                     });
                 } else {
                     cardsDone++;
                     if (cardsDone === currentMeld.length) {
                         meldIndex++;
                         playNextMeld();
                     }
                 }
            });
        };

        playNextMeld();
    }
}
