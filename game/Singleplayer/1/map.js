// New module to load an optional map GLTF and provide ground height queries
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';

let sceneMeshes = [];
let fallbackGroundY = 0;
let raycaster = new THREE.Raycaster();
raycaster.far = 2000;
export function getGroundHeight(x, z) {
    if (sceneMeshes.length > 0) {
        const origin = new THREE.Vector3(x, 1000, z);
        const dir = new THREE.Vector3(0, -1, 0);
        raycaster.set(origin, dir);
        const intersects = raycaster.intersectObjects(sceneMeshes, true);
        if (intersects && intersects.length > 0) {
            return intersects[0].point.y;
        }
    }
    return fallbackGroundY;
}

export async function initMap(params = {}) {
    const path = '../../../assets/map/scene.gltf';
    const sceneObj = params.scene;
    const loader = params.loader || new GLTFLoader();
    const dir = params.dir;
    const player = params.player;
    const placeholder = params.placeholder;
    const blobShadow = params.blobShadow;
    const ground = params.ground;

    return new Promise((resolve) => {
        loader.load(path, (gltf) => {
            console.log('Map GLTF loaded from', path);
            if (ground && sceneObj) {
                try { sceneObj.remove(ground); } catch (e) {}
            }

            const mapRoot = gltf.scene || gltf.scenes[0];
            mapRoot.traverse((c) => {
                if (c.isMesh) {
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
            sceneObj.add(mapRoot);
            sceneMeshes = [];
            mapRoot.traverse((c) => { if (c.isMesh) sceneMeshes.push(c); });
            const box = new THREE.Box3().setFromObject(mapRoot);
            if (box.isEmpty() === false) {
                fallbackGroundY = box.min.y;
            } else {
                fallbackGroundY = 0;
            }
            if (blobShadow && player) {
                const sizeX = box.max.x - box.min.x;
                const sizeZ = box.max.z - box.min.z;
                const blobScale = Math.max(sizeX, sizeZ, 0.6) * 0.6;
                blobShadow.scale.set(blobScale, blobScale, 1);
            }
            if (dir && player) {
                const playerPos = player.position || new THREE.Vector3();
                const extent = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, 1) * 1.5;
                dir.shadow.camera.left = -extent;
                dir.shadow.camera.right = extent;
                dir.shadow.camera.top = extent;
                dir.shadow.camera.bottom = -extent;
                dir.shadow.camera.near = 0.1;
                dir.shadow.camera.far = Math.max(50, (box.max.y - box.min.y) * 10 + 50);
                dir.position.copy(playerPos).add(new THREE.Vector3(5, 10, 7));
                dir.shadow.camera.updateProjectionMatrix();
            }
            console.log('Map initialized. fallbackGroundY =', fallbackGroundY);
            if (placeholder) placeholder.visible = false;
            resolve(true);
        }, undefined, (err) => {
            console.warn('Map GLTF not found or failed to load at', path, err);
            resolve(false);
        });
    });
}
