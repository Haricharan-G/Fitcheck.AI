import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface Props {
  type: "squat" | "pushUp" | "warriorII" | string;
  className?: string;
}

export function StudioMannequin({ type, className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    
    // Check if the container actually has a size. Sometimes React renders it before layout.
    // We'll use a ResizeObserver to handle sizing properly.
    let width = container.clientWidth;
    let height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / (height || 1), 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: false });
    const group = new THREE.Group();
    scene.add(group);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.6, 4, 8), bodyMaterial);
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), bodyMaterial);
    group.add(head);

    const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.6, 4, 8), bodyMaterial);
    const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.6, 4, 8), bodyMaterial);
    group.add(armL, armR);

    const thighL = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), bodyMaterial);
    const thighR = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), bodyMaterial);
    const calfL = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), bodyMaterial);
    const calfR = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), bodyMaterial);
    group.add(thighL, thighR, calfL, calfR);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.6);
    mainLight.position.set(5, 10, 7);
    scene.add(mainLight);

    const cyanLight = new THREE.PointLight(0x22d3ee, 1, 10);
    cyanLight.position.set(0, 2, -2);
    scene.add(cyanLight);

    if (type === 'squat') {
        camera.position.set(3, 1.5, 5);
        camera.lookAt(0, 1, 0);
        torso.position.y = 1.6;
        head.position.y = 2.4;
        armL.position.set(-0.4, 1.5, 0.3);
        armR.position.set(0.4, 1.5, 0.3);
        armL.rotation.x = Math.PI / 4;
        armR.rotation.x = Math.PI / 4;
    } else if (type === 'pushUp') {
        camera.position.set(3, 2, 4);
        camera.lookAt(0, 0.5, 0);
        group.rotation.y = Math.PI / 4;
        torso.rotation.x = Math.PI / 2;
        head.rotation.x = Math.PI / 2;
        torso.position.set(0, 0.8, 0);
        head.position.set(0, 0.8, 0.8);
        thighL.rotation.x = Math.PI / 2;
        thighR.rotation.x = Math.PI / 2;
        calfL.rotation.x = Math.PI / 2;
        calfR.rotation.x = Math.PI / 2;
        thighL.position.set(-0.2, 0.6, -0.6);
        thighR.position.set(0.2, 0.6, -0.6);
        calfL.position.set(-0.2, 0.4, -1.2);
        calfR.position.set(0.2, 0.4, -1.2);
        armL.position.set(-0.4, 0.4, 0.3);
        armR.position.set(0.4, 0.4, 0.3);
    } else { // warriorII or default
        camera.position.set(0, 1.5, 5);
        camera.lookAt(0, 1.2, 0);
        torso.position.y = 1.4;
        head.position.y = 2.2;
        head.rotation.y = Math.PI / 2;
        armL.position.set(-0.8, 1.5, 0);
        armR.position.set(0.8, 1.5, 0);
        armL.rotation.z = Math.PI / 2;
        armR.rotation.z = Math.PI / 2;
        thighL.position.set(-0.4, 0.9, 0);
        calfL.position.set(-0.8, 0.4, 0);
        thighL.rotation.z = -Math.PI / 4;
        thighR.position.set(0.4, 1.0, 0);
        calfR.position.set(0.4, 0.4, 0);
        thighR.rotation.z = Math.PI / 2;
    }

    let animationFrameId: number;

    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        const t = Date.now() * 0.002;
        
        if (type === 'squat') {
            group.rotation.y = Math.sin(t * 0.2) * 0.2;
            if (hovered) {
                const squatDepth = (Math.sin(t * 1.5) + 1) / 2;
                group.position.y = -squatDepth * 0.6;
                thighL.position.set(-0.2, 1.1 - squatDepth*0.2, 0 + squatDepth*0.2);
                thighR.position.set(0.2, 1.1 - squatDepth*0.2, 0 + squatDepth*0.2);
                thighL.rotation.x = -squatDepth * 1.2;
                thighR.rotation.x = -squatDepth * 1.2;
                calfL.position.set(-0.2, 0.5 - squatDepth*0.1, 0);
                calfR.position.set(0.2, 0.5 - squatDepth*0.1, 0);
                calfL.rotation.x = squatDepth * 1.5;
                calfR.rotation.x = squatDepth * 1.5;
            } else {
                group.position.y = 0;
                thighL.position.set(-0.2, 1.1, 0);
                thighR.position.set(0.2, 1.1, 0);
                thighL.rotation.x = 0;
                thighR.rotation.x = 0;
                calfL.position.set(-0.2, 0.5, 0);
                calfR.position.set(0.2, 0.5, 0);
                calfL.rotation.x = 0;
                calfR.rotation.x = 0;
            }
        } else if (type === 'pushUp') {
            if (hovered) {
                const pushDepth = (Math.sin(t * 2) + 1) / 2;
                group.position.y = -pushDepth * 0.3;
                armL.position.set(-0.4, 0.4 + pushDepth*0.15, 0.3);
                armR.position.set(0.4, 0.4 + pushDepth*0.15, 0.3);
                armL.rotation.x = -pushDepth * 0.5;
                armR.rotation.x = -pushDepth * 0.5;
            } else {
                group.position.y = 0;
                armL.position.set(-0.4, 0.4, 0.3);
                armR.position.set(0.4, 0.4, 0.3);
                armL.rotation.x = 0;
                armR.rotation.x = 0;
            }
        } else {
            const breath = Math.sin(t) * 0.02;
            torso.scale.set(1 + breath, 1 + breath, 1 + breath);
            group.position.y = breath;
            group.rotation.y = Math.sin(t * 0.5) * 0.1;
        }

        renderer.render(scene, camera);
    };

    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              camera.aspect = width / height;
              camera.updateProjectionMatrix();
              renderer.setSize(width, height);
            }
        }
    });
    resizeObserver.observe(container);

    animate();

    return () => {
        cancelAnimationFrame(animationFrameId);
        resizeObserver.disconnect();
        renderer.dispose();
        scene.clear();
        if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement);
        }
    };
  }, [type, hovered]);

  return (
    <div 
      className={`relative w-full h-full transition-opacity duration-500 ${hovered ? 'opacity-100' : 'opacity-60'} ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div ref={containerRef} className="absolute inset-0 w-full h-full pointer-events-none" />
    </div>
  );
}
