/** Keyboard + pointer-lock mouse look. */
export function createInput(canvas) {
  const keys = Object.create(null);
  const mouse = { dx: 0, dy: 0, down: false, locked: false };
  let wantLock = false;

  function onKey(e, down) {
    keys[e.code] = down;
    if (down && (e.code === 'KeyB' || e.code === 'Tab' || e.code === 'KeyR' || e.code === 'Space'
      || e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4'
      || e.code === 'KeyG' || e.code === 'KeyF' || e.code === 'KeyE')) {
      e.preventDefault();
    }
  }

  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.down = true;
    if (wantLock && !mouse.locked) canvas.requestPointerLock();
  });
  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
  });
  document.addEventListener('pointerlockchange', () => {
    mouse.locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (!mouse.locked) return;
    mouse.dx += e.movementX;
    mouse.dy += e.movementY;
  });

  return {
    keys,
    mouse,
    requestLock() {
      wantLock = true;
      canvas.requestPointerLock();
    },
    consumeMouse() {
      const dx = mouse.dx;
      const dy = mouse.dy;
      mouse.dx = 0;
      mouse.dy = 0;
      return { dx, dy };
    },
    pressed(code) { return !!keys[code]; },
    eat(code) {
      if (keys[code]) { keys[code] = false; return true; }
      return false;
    },
  };
}
