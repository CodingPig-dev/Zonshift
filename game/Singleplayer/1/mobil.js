(function(){

    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    const body = document.body;
    if (!window.gameInput) window.gameInput = { moveVector: null, lookDelta: {x:0,y:0}, lookSensitivity: 0.0025, jumpRequest: false, useGamepad: false };
    window.gameInput.invertMoveX = (typeof window.gameInput.invertMoveX === 'boolean') ? window.gameInput.invertMoveX : true;
    const stickRadius = 56;
    const knobRadius = 28;
    const deadZone = 0.15;
    const lookPixelsPerUnit = 12;
    const gamepadLookScale = 6.0;

    function addStyles(){
        const css = `
        .mobile-ui-joystick{ position: fixed; width: ${stickRadius*2}px; height: ${stickRadius*2}px; border-radius: ${stickRadius}px; background: rgba(0,0,0,0.18); backdrop-filter: blur(2px); display:flex; align-items:center; justify-content:center; z-index:99990; touch-action:none; }
        .mobile-ui-joystick .knob{ width: ${knobRadius*2}px; height:${knobRadius*2}px; border-radius: ${knobRadius}px; background: rgba(255,255,255,0.12); box-shadow: 0 2px 6px rgba(0,0,0,0.6); transform: translate(0,0); }
        .mobile-ui-left{ left: 14px; bottom: 14px; }
        .mobile-ui-right{ right: 14px; bottom: 14px; }
        .mobile-ui-jump{ position: fixed; right: ${14 + stickRadius*2 + 12}px; bottom: 34px; width: 56px; height:56px; border-radius: 28px; background: rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; z-index:99990; font-weight:700; color:#fff; box-shadow: 0 3px 10px rgba(0,0,0,0.5); touch-action:none; }
        .mobile-ui-jump:active{ transform: scale(0.96); }
        `;
        const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    }

    function createJoystick(className){
        const el = document.createElement('div'); el.className = 'mobile-ui-joystick ' + className;
        const knob = document.createElement('div'); knob.className = 'knob'; el.appendChild(knob);
        el.style.opacity = '0.9';
        body.appendChild(el);
        return { el, knob };
    }


    function pixToVector(dx, dy){
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) return {x:0,y:0, r:0};
        const max = stickRadius - knobRadius;
        const nx = dx / max;
        const ny = dy / max;
        const mag = Math.hypot(nx, ny);
        if (mag < 1) return { x: nx, y: ny, r: mag };
        return { x: nx/mag, y: ny/mag, r: 1 };
    }

    if (!isTouch) {

    }

    addStyles();

    let leftStick = null, rightStick = null, jumpButton = null;
    if (isTouch) {
        const left = createJoystick('mobile-ui-left');
        const right = createJoystick('mobile-ui-right');
        const jump = document.createElement('button'); jump.className = 'mobile-ui-jump'; jump.textContent = 'A';
        body.appendChild(jump);
        leftStick = left; rightStick = right; jumpButton = jump;
    }

    const state = {
        left: { active: false, id: null, startX:0, startY:0, curX:0, curY:0 },
        right: { active: false, id: null, startX:0, startY:0, curX:0, curY:0 }
    };

    function setKnob(knobEl, dx, dy){
        knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    function resetKnob(knobEl){
        knobEl.style.transition = 'transform 120ms ease';
        setKnob(knobEl, 0, 0);
        setTimeout(()=>{ knobEl.style.transition = ''; }, 140);
    }

    function onTouchStart(ev){
        for (let i=0;i<ev.changedTouches.length;i++){
            const t = ev.changedTouches[i];
            const x = t.clientX, y = t.clientY;
            const w = window.innerWidth;
            const isLeft = x < w * 0.5;
            if (isLeft && leftStick && !state.left.active){
                state.left.active = true; state.left.id = t.identifier; state.left.startX = leftStick.el.offsetLeft + stickRadius; state.left.startY = leftStick.el.offsetTop + stickRadius; state.left.curX = x; state.left.curY = y;
                leftStick.el.style.left = (Math.max(14, x - stickRadius)) + 'px';
                leftStick.el.style.bottom = (window.innerHeight - y - stickRadius) + 'px';
                leftStick.el.style.right = '';
                leftStick.el.style.top = '';
                state.left.startX = x; state.left.startY = y;
                setKnob(leftStick.knob, 0, 0);
            } else if (!isLeft && rightStick && !state.right.active){
                state.right.active = true; state.right.id = t.identifier; state.right.startX = x; state.right.startY = y; state.right.curX = x; state.right.curY = y;
                rightStick.el.style.right = Math.max(14, (window.innerWidth - x - stickRadius)) + 'px';
                rightStick.el.style.bottom = (Math.max(14, y - (window.innerHeight - stickRadius))) + 'px';
                rightStick.el.style.left = '';
                rightStick.el.style.top = '';
                setKnob(rightStick.knob, 0, 0);
            }
        }
        ev.preventDefault();
    }

    function onTouchMove(ev){
        for (let i=0;i<ev.changedTouches.length;i++){
            const t = ev.changedTouches[i];
            const x = t.clientX, y = t.clientY;
            if (state.left.active && state.left.id === t.identifier){
                const dx = x - state.left.startX; const dy = y - state.left.startY;
                const v = pixToVector(dx, dy);
                const lx = v.x;
                const lz = -v.y;
                const mag = Math.hypot(lx, lz);
                let mx = 0, mz = 0;
                if (mag > deadZone) {
                    const s = (mag - deadZone) / (1 - deadZone);
                    const nx = lx / (mag||1);
                    const nz = lz / (mag||1);
                    mx = nx * s;
                    mz = nz * s;
                }
                const mvx = (window.gameInput.invertMoveX ? -mx : mx);
                const mvz = mz;
                window.gameInput.moveVector = { x: mvx, z: mvz };
                {
                    const angleRad = Math.atan2(mvz, mvx);
                    let angleDeg = angleRad * (180 / Math.PI);
                    angleDeg = (angleDeg + 180) ;
                    angleDeg = ((angleDeg % 360) + 360) % 360;
                    window.gameInput.moveAngleDeg = angleDeg;
                }
                const max = stickRadius - knobRadius;
                setKnob(leftStick.knob, Math.max(-max, Math.min(max, dx)), Math.max(-max, Math.min(max, dy)));
                state.left.curX = x; state.left.curY = y;
            }
            if (state.right.active && state.right.id === t.identifier){
                const dx = x - state.right.startX; const dy = y - state.right.startY;
                const v = pixToVector(dx, dy);
                const lookX = v.x * lookPixelsPerUnit;
                const lookY = v.y * lookPixelsPerUnit;
                window.gameInput.lookDelta.x = (window.gameInput.lookDelta.x || 0) + lookX;
                window.gameInput.lookDelta.y = (window.gameInput.lookDelta.y || 0) + lookY;
                const max = stickRadius - knobRadius;
                setKnob(rightStick.knob, Math.max(-max, Math.min(max, dx)), Math.max(-max, Math.min(max, dy)));
                state.right.curX = x; state.right.curY = y;
                state.right.startX = x; state.right.startY = y;
            }
        }
        ev.preventDefault();
    }

    function onTouchEnd(ev){
        for (let i=0;i<ev.changedTouches.length;i++){
            const t = ev.changedTouches[i];
            if (state.left.active && state.left.id === t.identifier){
                state.left.active = false; state.left.id = null; window.gameInput.moveVector = null; if (leftStick) resetKnob(leftStick.knob);
                window.gameInput.moveAngleDeg = null;
            }
            if (state.right.active && state.right.id === t.identifier){
                state.right.active = false; state.right.id = null; if (rightStick) resetKnob(rightStick.knob);
            }
        }
        ev.preventDefault();
    }

    if (isTouch) {
        window.addEventListener('touchstart', onTouchStart, {passive:false});
        window.addEventListener('touchmove', onTouchMove, {passive:false});
        window.addEventListener('touchend', onTouchEnd, {passive:false});
        window.addEventListener('touchcancel', onTouchEnd, {passive:false});
        if (jumpButton){
            let touching = false;
            jumpButton.addEventListener('touchstart', (e)=>{
                touching = true; window.gameInput.jumpRequest = true; e.preventDefault();
            }, {passive:false});
            jumpButton.addEventListener('mousedown', (e)=>{ touching = true; window.gameInput.jumpRequest = true; e.preventDefault(); });
            jumpButton.addEventListener('touchend', (e)=>{ touching=false; e.preventDefault(); });
        }

        window.addEventListener('gesturestart', (e)=>{ e.preventDefault(); });
    }
    let lastButtons = [];
    function pollGamepad(){
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        let gp = null;
        for (let i=0;i<pads.length;i++) if (pads[i]) { gp = pads[i]; break; }
        if (gp) {
            window.gameInput.useGamepad = true;
            const lx = gp.axes[0] || 0;
            const ly = gp.axes[1] || 0;
            const rx = gp.axes[2] || 0;
            const ry = gp.axes[3] || 0;
            function applyDead(a){ return Math.abs(a) < deadZone ? 0 : (Math.sign(a) * (Math.abs(a)-deadZone)/(1-deadZone)); }
            const mx = applyDead(lx);
            const mz = -applyDead(ly);
            {
                const mvx = (window.gameInput.invertMoveX ? -mx : mx);
                const mvz = mz;
                window.gameInput.moveVector = { x: mvx, z: mvz };
                const angleRad = Math.atan2(mvz, mvx);
                let angleDeg = angleRad * (180 / Math.PI);
                angleDeg = (angleDeg + 180);
                angleDeg = ((angleDeg % 360) + 360) % 360;
                window.gameInput.moveAngleDeg = angleDeg;
            }
            window.gameInput.lookDelta.x = (window.gameInput.lookDelta.x || 0) + rx * gamepadLookScale;
            window.gameInput.lookDelta.y = (window.gameInput.lookDelta.y || 0) + ry * gamepadLookScale;

            const btnA = gp.buttons[0];
            if (btnA) {
                const pressed = !!btnA.pressed;
                const prev = !!lastButtons[0];
                if (pressed && !prev) {
                    window.gameInput.jumpRequest = true;
                }
                lastButtons[0] = pressed;
            }
        } else {
            window.gameInput.useGamepad = false;
        }
        requestAnimationFrame(pollGamepad);
    }
    requestAnimationFrame(pollGamepad);
    window.addEventListener('keydown', (e)=>{
        if (e.code === 'KeyM'){
            if (leftStick) leftStick.el.style.display = (leftStick.el.style.display === 'none' ? '' : 'none');
            if (rightStick) rightStick.el.style.display = (rightStick.el.style.display === 'none' ? '' : 'none');
            if (jumpButton) jumpButton.style.display = (jumpButton.style.display === 'none' ? '' : 'none');
        }
    });
    window.mobileControls = {
        isTouch: isTouch,
        show: function(){ if (leftStick) leftStick.el.style.display=''; if (rightStick) rightStick.el.style.display=''; if (jumpButton) jumpButton.style.display=''; },
        hide: function(){ if (leftStick) leftStick.el.style.display='none'; if (rightStick) rightStick.el.style.display='none'; if (jumpButton) jumpButton.style.display='none'; }
    };

})();
