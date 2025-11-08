import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/RGBELoader.js';
import { initMap, getGroundHeight } from './map.js';
const index = this;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const lightTarget = new THREE.Object3D();
scene.add(lightTarget);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
let envMap = null;
const urlParams = new URLSearchParams(window.location.search);
const skipHDR = urlParams.has('nohdr');
const overlay = document.getElementById('loading-overlay');
const dotsEl = document.getElementById('loading-dots');
let dotsInterval = null;
function startDotsAnimation() {
    if (!dotsEl) return;
    let count = 0;
    dotsInterval = setInterval(() => {
        count = (count + 1) % 4;
        dotsEl.textContent = '.'.repeat(Math.max(1, count));
    }, 500);
}
function stopDotsAnimation() {
    if (dotsInterval) { clearInterval(dotsInterval); dotsInterval = null; }
}
function hideOverlay() {
    if (!overlay) return;
    overlay.classList.add('hidden');
    stopDotsAnimation();
    setTimeout(() => { try { overlay.remove(); } catch (e) {} }, 400);
}

startDotsAnimation();

let hdrPromise = Promise.resolve();
if (!skipHDR) {
    hdrPromise = new Promise((resolve) => {
        new RGBELoader().load('../../../assets/park.hdr', (hdrTexture) => {
            try {
                const pmrem = pmremGenerator.fromEquirectangular(hdrTexture);
                envMap = pmrem.texture;
                scene.environment = envMap;
                hdrTexture.dispose();
                pmremGenerator.dispose();
            } catch (e) {
                console.warn('Error applying HDR:', e);
            }
            resolve(true);
        }, undefined, (err) => {
            console.warn('Failed to load HDR at ../../../assets/park.hdr', err);
            resolve(false);
        });
    });
} else {
    console.log('Skipping HDR load due to ?nohdr');
}
const hemi = new THREE.HemisphereLight(0xccccff, 0x555555, 1.0);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0.08);
scene.add(ambient);
const dir = new THREE.DirectionalLight(0xffffff, 1.25);
dir.position.set(4.5, 10, 6.5);
dir.castShadow = true;
dir.shadow.mapSize.set(4096, 4096);
if (dir.shadow) {
    dir.shadow.radius = 1;
    dir.shadow.normalBias = 0.01;
}
dir.shadow.camera.near = 0.5;
dir.shadow.camera.far = 200;
dir.shadow.camera.left = -30;
dir.shadow.camera.right = 30;
dir.shadow.camera.top = 30;
dir.shadow.camera.bottom = -30;
dir.shadow.bias = -0.0004;
dir.target = lightTarget;
dir.shadow.camera.updateProjectionMatrix();
scene.add(dir);
const dirHelper = new THREE.CameraHelper(dir.shadow.camera);
scene.add(dirHelper);

dirHelper.visible = true;
setTimeout(() => { dirHelper.visible = false; }, 2000);
console.log('Directional light position', dir.position);
console.log('Directional light shadow camera bounds', dir.shadow.camera.left, dir.shadow.camera.right, dir.shadow.camera.top, dir.shadow.camera.bottom, dir.shadow.camera.near, dir.shadow.camera.far);

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyH') {
        dirHelper.visible = !dirHelper.visible;
        console.log('dirHelper.visible =', dirHelper.visible);
    }
    if (e.code === 'KeyP' && !e.repeat) {
        renderer.shadowMap.enabled = !renderer.shadowMap.enabled;
        console.log('renderer.shadowMap.enabled =', renderer.shadowMap.enabled);
        updateBlobVisibility();
    }
    if (e.code === 'BracketLeft' && !e.repeat) {
        dir.intensity = Math.max(0, dir.intensity - 0.05);
        console.log('dir.intensity ->', dir.intensity.toFixed(2));
    }
    if (e.code === 'BracketRight' && !e.repeat) {
        dir.intensity = Math.min(2, dir.intensity + 0.05);
        console.log('dir.intensity ->', dir.intensity.toFixed(2));
    }
    if (e.code === 'KeyK' && !e.repeat) {
        ambient.intensity = Math.max(0, ambient.intensity - 0.02);
        console.log('ambient.intensity ->', ambient.intensity.toFixed(3));
    }
    if (e.code === 'KeyL' && !e.repeat) {
        ambient.intensity = Math.min(1, ambient.intensity + 0.02);
        console.log('ambient.intensity ->', ambient.intensity.toFixed(3));
    }
    if (e.code === 'KeyE') {
        if (scene.environment) {
            scene.environment = null;
            console.log('Environment disabled');
        } else if (envMap) {
            scene.environment = envMap;
            console.log('Environment enabled');
        }
    }
});
const groundSize = 200;
const tileSize = 2;
const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
const texLoader = new THREE.TextureLoader();
const baseTexture = texLoader.load('../../../assets/base.png', () => {
    console.log('Base texture loaded');
});
baseTexture.wrapS = THREE.RepeatWrapping;
baseTexture.wrapT = THREE.RepeatWrapping;
baseTexture.repeat.set(groundSize / tileSize, groundSize / tileSize);
if (renderer.capabilities && typeof renderer.capabilities.getMaxAnisotropy === 'function') {
    baseTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
}
baseTexture.colorSpace = THREE.SRGBColorSpace;
const groundMat = new THREE.MeshStandardMaterial({map: baseTexture});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);
const placeholderGeo = new THREE.BoxGeometry(1,1.8,1);
const placeholderMat = new THREE.MeshStandardMaterial({color:0x7f3cff});
const placeholder = new THREE.Mesh(placeholderGeo, placeholderMat);
placeholder.castShadow = true;
placeholder.receiveShadow = true;
placeholder.position.y = 0.9;
scene.add(placeholder);
const player = new THREE.Object3D();
player.position.set(0,0,0);
scene.add(player);

const loader = new GLTFLoader();
let blobShadow = null;
(function(){
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size/2, cy = size/2;
    const grad = ctx.createRadialGradient(cx, cy, size*0.04, cx, cy, size*0.5);
    grad.addColorStop(0, 'rgba(0,0,0,0.12)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.03)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,size,size);
    const tex = new THREE.CanvasTexture(canvas);
    if (tex) tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({map: tex, transparent: true, depthWrite: false, opacity: 0.12});
    const geo = new THREE.PlaneGeometry(1,1);
    blobShadow = new THREE.Mesh(geo, mat);
    blobShadow.rotation.x = -Math.PI/2;
    blobShadow.position.y = 0.04;
    blobShadow.renderOrder = 0;
    blobShadow.receiveShadow = false;
    blobShadow.userData.autoHideWithRealShadows = true;
    player.add(blobShadow);
})();
function updateBlobVisibility() {
    if (!blobShadow) return;
    if (typeof renderer !== 'undefined' && renderer.shadowMap && renderer.shadowMap.enabled) {
        blobShadow.visible = false;
    } else {
        blobShadow.visible = true;
    }
}
updateBlobVisibility();
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyB' && !e.repeat) {
        if (!blobShadow) return;
        blobShadow.visible = !blobShadow.visible;
        console.log('blobShadow.visible ->', blobShadow.visible);
    }
    if (e.code === 'KeyN' && !e.repeat) {
        playerFill.visible = !playerFill.visible;
        console.log('playerFill.visible ->', playerFill.visible);
    }
});

let mapPromise = initMap({ scene, loader, dir, player, placeholder, blobShadow, ground }).then((ok) => {
    if (ok) {
        console.log('Map loaded and applied.');
        const y = getGroundHeight(player.position.x, player.position.z);
        player.position.y = Math.max(player.position.y, y);
    } else {
        console.log('No external map loaded; using fallback ground.');
    }
    return ok;
});

let camPitch = 0.2;
let camYaw = 0;
const camDistance = 4.0;
const camHeight = 1.6;
const mouseSensitivity = 0.0025;
camera.position.set(0, camHeight, camDistance);
camera.lookAt(new THREE.Vector3(0, camHeight, 0));
const keys = {w:false,a:false,s:false,d:false, space:false};
// expose a small bridge for external/mobile/gamepad input handlers
window.gameInput = {
    moveVector: null,
    lookDelta: { x: 0, y: 0 },
    lookSensitivity: mouseSensitivity + 0.025,
    jumpRequest: false,
    useGamepad: false
};

let velocity = new THREE.Vector3();
let onGround = true;
const walkSpeed = 4.0;
const jumpSpeed = 8.0;
const gravity = -20.0;
const canvas = renderer.domElement;
let pointerLocked = false;
document.addEventListener('click', () => {
    if (!pointerLocked) {
        canvas.requestPointerLock?.();
    }
});
document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
});
document.addEventListener('mousemove', (e) => {
    if (!pointerLocked) return;
    camYaw -= e.movementX * mouseSensitivity;
    camPitch -= e.movementY * mouseSensitivity;
    camPitch = Math.max(-0.6, Math.min(0.6, camPitch));
});
window.addEventListener('keydown', (e)=>{
    if (e.code === 'KeyW') keys.w = true;
    if (e.code === 'KeyA') keys.d = true;
    if (e.code === 'KeyS') keys.s = true;
    if (e.code === 'KeyD') keys.a = true;
    if (e.code === 'Space') keys.space = true;
});
window.addEventListener('keyup', (e)=>{
    if (e.code === 'KeyW') keys.w = false;
    if (e.code === 'KeyA') keys.d = false;
    if (e.code === 'KeyS') keys.s = false;
    if (e.code === 'KeyD') keys.a = false;
    if (e.code === 'Space') keys.space = false;
});
function isExternalUrl(path) {
    if (!path) return false;
    return /^(?:https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:');
}

let modelPath = localStorage.getItem('Model') || new URLSearchParams(window.location.search).get('model') || '';
let modelUrl = '';
if (modelPath && modelPath.trim() !== '') {
    modelPath = modelPath.trim();
    if (isExternalUrl(modelPath) || modelPath.startsWith('/')) {
        modelUrl = modelPath;
    } else {
        modelUrl = "../../" + modelPath;
    }
} else {
        modelUrl = '../../../assets/skins/test/test.gltf';
}
let playerModel = null;
console.log('Loading model from', modelUrl);

let modelPromise = new Promise((resolve, reject) => {
    loader.load(modelUrl, (gltf) => {
        resolve(gltf);
    }, undefined, (err) => {
        console.warn('Failed to load model at', modelUrl, err);
        resolve(null);
    });
});

modelPromise.then((gltf) => {
    if (!gltf) return;
    const gltfScene = gltf.scene;
    playerModel = gltfScene;
    playerModel.scale.set(1,1,1);
    const rawBox = new THREE.Box3().setFromObject(playerModel);
    const rawSize = new THREE.Vector3(); rawBox.getSize(rawSize);
    const rawHeight = rawSize.y || 1.0;
    const desiredHeight = 1.8;
    let scaleUniform = desiredHeight / rawHeight;
    const maxFootprint = 1.0;
    const widthAfter = rawSize.x * scaleUniform;
    const depthAfter = rawSize.z * scaleUniform;
    if (widthAfter > maxFootprint || depthAfter > maxFootprint) {
        const capX = maxFootprint / Math.max(widthAfter, 1e-6);
        const capZ = maxFootprint / Math.max(depthAfter, 1e-6);
        const cap = Math.min(capX, capZ);
        scaleUniform = scaleUniform * cap;
        console.log('Capping uniform scale to fit footprint:', {cap, scaleUniform, widthAfter, depthAfter});
    }
    playerModel.scale.setScalar(scaleUniform);
    const box2 = new THREE.Box3().setFromObject(playerModel);
    const min = box2.min;
    playerModel.position.y -= min.y;

    let meshCount = 0;
    playerModel.traverse((c) => {
        if (c.isMesh) {
            meshCount++;
            c.castShadow = true;
            c.receiveShadow = true;
            if (c.material) {
                if (Array.isArray(c.material)) {
                    c.material.forEach(m => { if (m) { m.envMapIntensity = m.envMapIntensity ?? 1.0; m.needsUpdate = true; } });
                } else {
                    c.material.envMapIntensity = c.material.envMapIntensity ?? 1.0;
                    c.material.needsUpdate = true;
                }
            }
        }
    });
    console.log('Loaded player model, meshes:', meshCount, 'rawSize:', rawSize, 'scaleUniform:', scaleUniform);
    player.add(playerModel);
    placeholder.visible = false;
    const playerBox = new THREE.Box3().setFromObject(playerModel);
    const playerSize = new THREE.Vector3(); playerBox.getSize(playerSize);
    const extent = Math.max(playerSize.x, playerSize.z, 1) * 2.5;
    dir.shadow.camera.left = -extent;
    dir.shadow.camera.right = extent;
    dir.shadow.camera.top = extent;
    dir.shadow.camera.bottom = -extent;
    dir.shadow.camera.near = 0.1;
    dir.shadow.camera.far = Math.max(50, playerSize.y * 10 + 50);
    dir.position.copy(player.position).add(new THREE.Vector3(5, 10, 7));
    dir.shadow.camera.updateProjectionMatrix();
    console.log('Updated shadow camera bounds to', dir.shadow.camera.left, dir.shadow.camera.right, dir.shadow.camera.top, dir.shadow.camera.bottom, 'near/far', dir.shadow.camera.near, dir.shadow.camera.far);
    if (blobShadow) {
        const blobScale = Math.max(playerSize.x, playerSize.z, 0.6) * 0.9;
        blobShadow.scale.set(blobScale, blobScale, 1);
        updateBlobVisibility();
    }
});

Promise.allSettled([hdrPromise, mapPromise, modelPromise]).then(() => {
    setTimeout(() => { hideOverlay(); }, 200);
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
const clock = new THREE.Clock();
function updateMovement(delta) {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() === 0) forward.set(0,0,-1);
    forward.normalize();
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    let inputZ = 0;
    let inputX = 0;
    if (window.gameInput && window.gameInput.moveVector) {
        inputX = window.gameInput.moveVector.x || 0;
        inputZ = window.gameInput.moveVector.z || 0;
    } else {
        if (keys.w) inputZ += 1;
        if (keys.s) inputZ -= 1;
        if (keys.d) inputX += 1;
        if (keys.a) inputX -= 1;
    }
    const inputVec = new THREE.Vector3();
    inputVec.copy(forward).multiplyScalar(inputZ).addScaledVector(right, inputX);
    if (inputVec.lengthSq() > 0.0001) {
        inputVec.normalize();
        const horiz = inputVec.multiplyScalar(walkSpeed);
        velocity.x = horiz.x;
        velocity.z = horiz.z;
        const angle = Math.atan2(velocity.x, velocity.z);
        const rotDiff = angle - player.rotation.y;
        const PI2 = Math.PI * 2;
        let nd = ((rotDiff + Math.PI) % PI2) - Math.PI;
        player.rotation.y += nd * Math.min(1, 10 * delta);
    } else {
        velocity.x = 0;
        velocity.z = 0;
    }
    player.position.x += velocity.x * delta;
    player.position.z += velocity.z * delta;
    velocity.y += gravity * delta;
    const tentativeY = player.position.y + velocity.y * delta;
    const groundY = getGroundHeight(player.position.x, player.position.z);
    if (tentativeY <= groundY + 0.001) {
        player.position.y = groundY;
        velocity.y = 0;
        onGround = true;
    } else {
        player.position.y = tentativeY;
        onGround = false;
    }
    if (window.gameInput && window.gameInput.jumpRequest) {
        if (onGround) {
            velocity.y = jumpSpeed;
            onGround = false;
        }
        window.gameInput.jumpRequest = false;
    }

    if (keys.space && onGround) {
        velocity.y = jumpSpeed;
        onGround = false;
    }
}
function updateCamera(delta) {
    const offset = new THREE.Vector3(0, camHeight, camDistance);
    const rot = new THREE.Euler(camPitch, camYaw, 0, 'YXZ');
    offset.applyEuler(rot);
    const desiredPos = new THREE.Vector3().copy(player.position).add(offset);
    const t = 1 - Math.pow(0.01, delta);
    camera.position.lerp(desiredPos, t);
    const lookAt = new THREE.Vector3().copy(player.position).add(new THREE.Vector3(0, camHeight * 0.9, 0));
    camera.lookAt(lookAt);
    lightTarget.position.copy(player.position);
}
(function animate(){
    requestAnimationFrame(animate);
    const delta = Math.min(0.05, clock.getDelta());
    if (window.gameInput) {
        const g = window.gameInput;
        const sens = g.lookSensitivity ?? mouseSensitivity;
        const lx = g.lookDelta?.x || 0;
        const ly = g.lookDelta?.y || 0;
        camYaw -= lx * sens;
        camPitch -= ly * sens;
        g.lookDelta.x = 0;
        g.lookDelta.y = 0;
        camPitch = Math.max(-0.6, Math.min(0.6, camPitch));
    }

    updateMovement(delta);
    updateCamera(delta);
    renderer.render(scene,camera);
})();



