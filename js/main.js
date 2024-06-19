import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let camera, scene, renderer, stats, object, loader, guiMorphsFolder;
const clock = new THREE.Clock();
let mixer;

// Variables para la esfera
let sphere, spheres = [];

// Variables para el movimiento de la cámara
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
const moveSpeed = 50; // Velocidad de movimiento de la cámara

const params = {
    asset: 'Mutant Right Turn 45',
};

const assets = [
    'Mutant Right Turn 45',
    'Sword And Shield Crouch Block Idle',
    'Mutant Flexing Muscles',
    'Dodging Right',
    'Running',
    'Walking',
    'Stop Walking'
];

init();

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(100, 200, 500); // Aumenta el valor en el eje Z para alejar la cámara

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa0a0a0);
    scene.fog = new THREE.Fog(0xa0a0a0, 200, 1000);

    const hemiLight = new THREE.HemisphereLight(0xadd8e6, 0x444444, 5); // Cambia el primer parámetro a un tono azul claro
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0x6095eb, 30);
    dirLight.position.set(0, 200, 100);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 180;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    scene.add(dirLight);

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add(mesh);

    loader = new FBXLoader();
    loadAsset(params.asset);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 100, 0);
    controls.update();

    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    stats = new Stats();
    container.appendChild(stats.dom);

    const gui = new GUI();
    gui.add(params, 'asset', assets).onChange(function (value) {
        loadAsset(value);
    });

    guiMorphsFolder = gui.addFolder('Morphs').hide();

    // Inicializar variables de física
    sphere = new THREE.Mesh(new THREE.SphereGeometry(2, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    scene.add(sphere);

    // Generar esferas adicionales para simular nieve
    generateSpheres();
}

function generateSpheres() {
    const numSpheres = 30; // Número de esferas adicionales a generar
    for (let i = 0; i < numSpheres; i++) {
        const randomX = Math.random() * 800 - 400; // Posición aleatoria en el rango (-200, 200)
        const randomZ = Math.random() * 800 - 400; // Posición aleatoria en el rango (-200, 200)

        const sphereGeometry = new THREE.SphereGeometry(2, 32, 32);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const sphereClone = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphereClone.position.set(randomX, sphere.position.y, randomZ);
        scene.add(sphereClone);

        spheres.push(sphereClone);
    }
    // Llamar a la función de nuevo después de un intervalo de tiempo
    setTimeout(generateSpheres, 500); // Generar esferas cada 0.5 segundos
}

function loadAsset(asset) {
    loader.load('models/fbx/' + asset + '.fbx', function (group) {
        if (object) {
            object.traverse(function (child) {
                if (child.material) child.material.dispose();
                if (child.material && child.material.map) child.material.map.dispose();
                if (child.geometry) child.geometry.dispose();
            });
            scene.remove(object);
        }

        object = group;

        if (object.animations && object.animations.length) {
            mixer = new THREE.AnimationMixer(object);
            const action = mixer.clipAction(object.animations[0]);
            action.play();
        } else {
            mixer = null;
        }

        guiMorphsFolder.children.forEach((child) => child.destroy());
        guiMorphsFolder.hide();

        object.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.morphTargetDictionary) {
                    guiMorphsFolder.show();
                    const meshFolder = guiMorphsFolder.addFolder(child.name || child.uuid);
                    Object.keys(child.morphTargetDictionary).forEach((key) => {
                        meshFolder.add(child.morphTargetInfluences, child.morphTargetDictionary[key], 0, 1, 0.01);
                    });
                }
            }
        });

        // Agregar la esfera blanca arriba del modelo
        const box = new THREE.Box3().setFromObject(group);
        sphere.position.set(0, box.max.y + Math.floor(Math.random() * (70 - 50 + 1)) + 50, 0); // Generar un número entre 50 y 70 para la posición vertical

        // Obtener la caja delimitadora de la esfera para la detección de colisiones
        const sphereBoundingBox = new THREE.Box3().setFromObject(sphere);

        // Colocar la cámara
        camera.position.set(100, 200, 300);

        scene.add(object);
    });
}

function animate() {
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    // Aplicar la física de caída a todas las esferas generadas
    spheres.forEach(sphere => {
        sphere.position.y -= 50 * delta; // Aplica la velocidad de caída
        if (sphere.position.y <= 2) {
            sphere.position.y = 2; // Fija la posición mínima al suelo
        }
    });

    // Actualizar la posición de la cámara
    if (moveForward) camera.position.z -= moveSpeed * delta;
    if (moveBackward) camera.position.z += moveSpeed * delta;
    if (moveLeft) camera.position.x -= moveSpeed * delta;
    if (moveRight) camera.position.x += moveSpeed * delta;

    renderer.render(scene, camera);
    stats.update();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp':
            moveForward = true;
            break;
        case 'ArrowDown':
            moveBackward = true;
            break;
        case 'ArrowLeft':
            moveLeft = true;
            break;
        case 'ArrowRight':
            moveRight = true;
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
            moveForward = false;
            break;
        case 'ArrowDown':
            moveBackward = false;
            break;
        case 'ArrowLeft':
            moveLeft = false;
            break;
        case 'ArrowRight':
            moveRight = false;
            break;
    }
}

// Añadir eventos de clic para las teclas en pantalla
document.getElementById('key-up').addEventListener('mousedown', () => { moveForward = true; });
document.getElementById('key-up').addEventListener('mouseup', () => { moveForward = false; });
document.getElementById('key-down').addEventListener('mousedown', () => { moveBackward = true; });
document.getElementById('key-down').addEventListener('mouseup', () => { moveBackward = false; });
document.getElementById('key-left').addEventListener('mousedown', () => { moveLeft = true; });
document.getElementById('key-left').addEventListener('mouseup', () => { moveLeft = false; });
document.getElementById('key-right').addEventListener('mousedown', () => { moveRight = true; });
document.getElementById('key-right').addEventListener('mouseup', () => { moveRight = false; });
