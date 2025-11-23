import { GameState } from "./GameState";
import { ICard } from "./types";

export class UIManager {
    private game: GameState;
    private ui = {
        stock: document.getElementById('stock-pile')!,
        discard: document.getElementById('discard-pile')!,
        pHand: document.getElementById('player-hand')!,
        cHand: document.getElementById('cpu-hand')!,
        table: document.getElementById('table-zone')!,
        status: document.getElementById('status-text')!,
        score: document.getElementById('score-text')!,
        btnMeld: document.getElementById('btn-meld') as HTMLButtonElement,
        btnCancel: document.getElementById('btn-cancel') as HTMLButtonElement,
        btnDiscard: document.getElementById('btn-discard') as HTMLButtonElement,
        modal: document.getElementById('modal')!,
        modalMsg: document.getElementById('modal-msg')!,
        alertModal: document.getElementById('alert-modal')!,
        alertTitle: document.getElementById('alert-title')!,
        alertMsg: document.getElementById('alert-msg')!,
        alertIcon: document.getElementById('alert-icon')!
    };

    constructor(game: GameState) {
        this.game = game;
    }

    public render() {
        const { round, turnPoints, discardPile, pHand, cHand, melds, turnMelds, hasOpened, turn, bottomCard, phase, drawnFromDiscardId } = this.game;

        this.ui.score.innerText = `Rd: ${round} | Pts: ${turnPoints}`;

        const isMyTurn = turn === 'human';
        const isDrawPhase = isMyTurn && phase === 'draw';
        const isActionPhase = isMyTurn && phase === 'action';

        // --- Stock Pile ---
        this.ui.stock.className = `card card-back ${isDrawPhase ? 'interactive' : ''}`;
        
        // --- Bottom Card ---
        if (bottomCard) {
             this.ui.stock.style.position = 'relative'; 
             this.ui.stock.style.zIndex = '10';
             this.ui.stock.style.boxShadow = "2px 2px 0 #fff, 4px 4px 0 #000"; 
             
             let bEl = document.getElementById('bottom-card-display');
             if(!bEl) {
                 bEl = document.createElement('div');
                 bEl.id = 'bottom-card-display';
                 bEl.style.position = 'absolute';
                 bEl.style.top = '5px'; 
                 bEl.style.left = '40px'; 
                 bEl.style.zIndex = '1'; 
                 bEl.style.transform = 'rotate(10deg)';
                 this.ui.stock.parentElement?.appendChild(bEl);
             }
             
             bEl.className = `card ${bottomCard.getColor()}`;
             bEl.innerHTML = this.renderCardInner(bottomCard);
             bEl.title = "Jolly Hand (Click to take in Round 3+)";
             
             const canTakeJolly = isDrawPhase && round >= 3 && pHand.length === 12;
             
             if (canTakeJolly) {
                 bEl.classList.add('interactive');
                 bEl.onclick = () => (window as any).game.attemptJolly();
                 // Removed yellow highlight
                 bEl.style.boxShadow = "1px 1px 3px rgba(0,0,0,0.5)";
             } else {
                 bEl.classList.remove('interactive');
                 bEl.onclick = null;
                 bEl.style.boxShadow = "1px 1px 3px rgba(0,0,0,0.5)";
             }

        } else {
             const bEl = document.getElementById('bottom-card-display');
             if(bEl) bEl.remove();
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
        pHand.forEach(c => {
            const el = document.createElement('div');
            const handInteractive = isMyTurn ? 'interactive' : '';
            el.className = `card ${c.getColor()} ${c.selected ? 'selected' : ''} ${handInteractive}`;
            el.dataset.id = c.id.toString(); 
            el.innerHTML = this.renderCardInner(c);
            el.onclick = () => this.handleCardClick(c);
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
            
            grp.className = `meld-group ${isPending ? 'pending' : ''}`;
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
                el.innerHTML = this.renderCardInner(c);
                grp.appendChild(el);
            });
            this.ui.table.appendChild(grp);
        });

        const selectedCount = pHand.filter(c => c.selected).length;
        this.ui.btnMeld.disabled = selectedCount < 1; 
        this.ui.btnDiscard.disabled = selectedCount !== 1;
        
        // --- Cancel / Undo Logic ---
        const canUndoDraw = isActionPhase && drawnFromDiscardId && turnMelds.length === 0;
        const canCancelMelds = turnMelds.length > 0 && !hasOpened.human;

        if (canUndoDraw) {
            this.ui.btnCancel.style.display = 'block';
            this.ui.btnCancel.innerText = 'Undo Draw';
            this.ui.btnCancel.onclick = () => (window as any).game.undoDraw();
        } else if (canCancelMelds) {
            this.ui.btnCancel.style.display = 'block';
            this.ui.btnCancel.innerText = 'Cancel Melds';
            this.ui.btnCancel.onclick = () => (window as any).game.cancelMelds();
        } else {
            this.ui.btnCancel.style.display = 'none';
        }
    }

    public updateStatus(msg: string) {
        this.ui.status.innerText = msg;
    }

    public showWinModal(msg: string) {
        this.ui.modalMsg.innerText = msg;
        this.ui.modal.style.display = 'flex';
    }

    public closeWinModal() {
        this.ui.modal.style.display = 'none';
    }

    public showAlert(msg: string, title: string = 'Alert', icon: string = '⚠️', isHtml: boolean = false) {
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
        card.selected = !card.selected;
        this.render();
    }

    private handleMeldClick(meldIdx: number) {
        if (this.game.phase !== 'action') return;
        const selected = this.game.pHand.filter(c => c.selected);
        if (selected.length === 0) return;

        if (selected.length === 1) {
            const res = this.game.attemptJokerSwap(meldIdx, selected[0].id);
            if (res.success) {
                this.render();
                return;
            }
        }

        const res = this.game.addToExistingMeld(meldIdx, selected);
        if (res.success) {
            if (res.winner) this.showWinModal(`${res.winner} Wins!`);
            this.render();
        } else {
            this.showAlert(res.msg || "Invalid Move");
        }
    }

    public animateDraw(card: ICard, source: 'stock' | 'discard', onComplete: () => void) {
        const sourceEl = source === 'stock' ? this.ui.stock : this.ui.discard;
        const targetEl = this.ui.pHand.querySelector(`[data-id="${card.id}"]`) as HTMLElement;

        if (!sourceEl || !targetEl) {
            onComplete();
            return;
        }
        targetEl.style.opacity = '0';
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
            targetEl.style.opacity = '1';
            onComplete();
        }, 500);
    }
}
