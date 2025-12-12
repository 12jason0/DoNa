"use client";

import React from "react";
import * as THREE from "three";

interface StoneTileProps {
    position: [number, number, number];
    size?: number;
    material: THREE.Material | THREE.MeshStandardMaterial;
}

export default function StoneTile({ position, size = 2, material }: StoneTileProps) {
    return (
        <mesh position={position} rotation-x={-Math.PI / 2} receiveShadow castShadow material={material}>
            <planeGeometry args={[size, size]} />
        </mesh>
    );
}
