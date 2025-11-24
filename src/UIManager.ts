import { GameState } from "./GameState";
import { ICard } from "./types";
import { SoundManager } from "./core/SoundManager";
import { validateMeld, organizeMeld } from "./core/rules";

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
        alertIcon: document.getElementById('alert-icon')!
    };

    // Drag State
    private dragSourceIndex: number | null = null;

    constructor(game: GameState) {
        this.game = game;
        this.sound = new SoundManager();
    }

    public render() {
        const { round, turnPoints, discardPile, pHand, cHand, melds, turnMelds, hasOpened, turn, bottomCard, phase, drawnFromDiscardId } = this.game;

        this.ui.score.innerText = `Rd: ${round} | Pts: ${turnPoints}`;

        const isMyTurn = turn === 'human';
        const isDrawPhase = isMyTurn && phase === 'draw';
        const isActionPhase = isMyTurn && phase === 'action';
        const selected = pHand.filter(c => c.selected);

        // --- Valid Move Calculations ---
        let isMeldValid = false;
        let validTargets: number[] = [];

        if (isActionPhase && selected.length > 0) {
            // Check New Meld Validity
            if (selected.length >= 3) {
                const res = validateMeld(selected);
                if (res.valid) isMeldValid = true;
            }
            // Check Add-to-Meld Validity (if opened)
            if (hasOpened.human) {
                melds.forEach((m, i) => {
                    const organized = organizeMeld([...m, ...selected]);
                    if (validateMeld(organized).valid) {
                        validTargets.push(i);
                    }
                });
            }
        }

        // --- Stock Pile ---
        this.ui.stock.className = `card card-back ${isDrawPhase ? 'interactive' : ''}`;

        // --- Bottom Card ---
        if (bottomCard) {
            this.ui.stock.style.position = 'relative';
            this.ui.stock.style.zIndex = '10';

            let bEl = document.getElementById('bottom-card-display');
            if (!bEl) {
                bEl = document.createElement('div');
                bEl.id = 'bottom-card-display';
                bEl.style.position = 'absolute';
                bEl.style.top = '15px';
                bEl.style.left = '0';
                bEl.style.zIndex = '1';
                bEl.style.transform = 'translateY(35px)';
                this.ui.stock.parentElement?.appendChild(bEl);
            }

            bEl.className = `card ${bottomCard.getColor()}`;
            bEl.innerHTML = this.renderCardInner(bottomCard);
            bEl.title = "Jolly Hand (Click to take in Round 3+)";

            const canTakeJolly = isDrawPhase && round >= 3 && pHand.length === 12;

            if (canTakeJolly) {
                bEl.classList.add('interactive');
                bEl.onclick = () => (window as any).game.attemptJolly();
                bEl.style.boxShadow = "1px 1px 3px rgba(0,0,0,0.5)";
            } else {
                bEl.classList.remove('interactive');
                bEl.onclick = null;
                bEl.style.boxShadow = "1px 1px 3px rgba(0,0,0,0.5)";
            }

        } else {
            const bEl = document.getElementById('bottom-card-display');
            if (bEl) bEl.remove();
        }

        // --- Discard Pile ---
        if (discardPile.length > 0) {
            const top = discardPile[discardPile.length - 1];
            this.ui.discard.innerHTML = this.renderCardInner(top);
            const canDrawDiscard = isDrawPhase && round >= 3;
            const discardInteractive = canDrawDiscard ? 'interactive' : '';
            this.ui.discard.className = `card ${top.getColor()} ${discardInteractive}`;
            this.ui.discard.style.opacity = "1";
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
                // Fixed: Remove unused parameter
                el.onclick = () => {
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
            const isPending = turnMelds.includes(idx) && !hasOpened.human && turn === 'human';
            const isValidTarget = validTargets.includes(idx);

            grp.className = `meld-group ${isPending ? 'pending' : ''} ${isValidTarget ? 'valid-target' : ''}`;
            if (isActionPhase) {
                grp.style.cursor = 'pointer';
                grp.onclick = () => this.handleMeldClick(idx);
            } else {
                grp.style.cursor = 'default';
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
        const canUndoDraw = isActionPhase && drawnFromDiscardId && turnMelds.length === 0;
        const canCancelMelds = turnMelds.length > 0 && !hasOpened.human;

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

    public updateStatus(msg: string) {
        this.ui.status.innerText = msg;
    }

    public showWinModal(msg: string) {
        this.sound.playWin();
        this.ui.modalMsg.innerText = msg;
        this.ui.modal.style.display = 'flex';
    }

    public closeWinModal() {
        this.ui.modal.style.display = 'none';
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
        return this.ui.pHand.querySelector(`[data-id="${id}"]`);
    }

    public getMeldElement(index: number): HTMLElement | null {
        const groups = this.ui.table.querySelectorAll('.meld-group');
        return groups[index] as HTMLElement;
    }

    private renderCardInner(c: ICard): string {
        if (c.isJoker) {
            const rep = c.representation;
            const topContent = rep ? `<span>${rep.rank}</span><span>${rep.suit}</span>` : `<span>🤡</span>`;
            const botContent = rep ? `<span>${rep.rank}</span><span>${rep.suit}</span>` : `<span>🤡</span>`;
            const style = rep ? 'color: gray; opacity: 0.7;' : '';

            return `
                <div class="card-top" style="${style}">${topContent}</div>
                <div class="card-center">🃏</div>
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

    public animateDiscard(card: ICard, startRect: DOMRect, onComplete: () => void) {
        this.sound.playSnap();

        const flyer = document.createElement('div');
        flyer.className = `card ${card.getColor()} flying-card`;
        flyer.innerHTML = this.renderCardInner(card);

        flyer.style.left = startRect.left + 'px';
        flyer.style.top = startRect.top + 'px';
        flyer.style.width = startRect.width + 'px';
        flyer.style.height = startRect.height + 'px';

        document.body.appendChild(flyer);
        flyer.offsetHeight;

        const endRect = this.ui.discard.getBoundingClientRect();

        flyer.style.left = endRect.left + 'px';
        flyer.style.top = endRect.top + 'px';

        setTimeout(() => {
            if (document.body.contains(flyer)) document.body.removeChild(flyer);
            onComplete();
        }, 500);
    }
}
