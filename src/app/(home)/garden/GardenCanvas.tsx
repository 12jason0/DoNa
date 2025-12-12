"use client";

import React, { useMemo, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky, useTexture } from "@react-three/drei";
import * as THREE from "three";
import StoneTile from "./StoneTile";
import { ItemType } from "./GardenScene";

export interface GardenCanvasProps {
    mode: "view" | "edit";
    grid: (ItemType | null)[][];
    setGrid: React.Dispatch<React.SetStateAction<(ItemType | null)[][]>>;
    selectedItem: ItemType;
    gridSize: number;
}

export default function GardenCanvas({ mode, grid, setGrid, selectedItem, gridSize }: GardenCanvasProps) {
    return (
        <Canvas shadows camera={{ position: [15, 20, 15], fov: 55 }}>
            <GardenSceneContent
                mode={mode}
                grid={grid}
                setGrid={setGrid}
                selectedItem={selectedItem}
                gridSize={gridSize}
            />
        </Canvas>
    );
}

function GardenSceneContent({ mode, grid, setGrid, selectedItem, gridSize }: GardenCanvasProps) {
    const CELL_SIZE = 2;

    const handleCellClick = (row: number, col: number) => {
        if (mode !== "edit" || !selectedItem) return;
        const newGrid = grid.map((r) => [...r]);
        newGrid[row][col] = selectedItem;
        setGrid(newGrid);
    };

    return (
        <>
            <Sky sunPosition={[100, 20, 100]} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[20, 25, 10]} intensity={1.2} castShadow />

            <OrbitControls
                enablePan={false}
                enableZoom
                maxDistance={60}
                minDistance={10}
                minPolarAngle={Math.PI / 3.5}
                maxPolarAngle={Math.PI / 3}
            />

            {/* 기본 잔디 */}
            <mesh rotation-x={-Math.PI / 2} receiveShadow>
                <planeGeometry args={[gridSize * CELL_SIZE, gridSize * CELL_SIZE]} />
                <meshStandardMaterial color="#bfe5a0" />
            </mesh>

            {/* 셀 + 오브젝트 렌더링 */}
            {Array.from({ length: gridSize }).map((_, row) =>
                Array.from({ length: gridSize }).map((_, col) => {
                    const pos: [number, number, number] = [
                        (col - gridSize / 2 + 0.5) * CELL_SIZE,
                        0.01,
                        (row - gridSize / 2 + 0.5) * CELL_SIZE,
                    ];
                    const item = grid[row][col];

                    return (
                        <group key={`cell-${row}-${col}`}>
                            <mesh
                                position={pos}
                                rotation-x={-Math.PI / 2}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCellClick(row, col);
                                }}
                            >
                                <planeGeometry args={[CELL_SIZE, CELL_SIZE]} />
                                <meshBasicMaterial transparent opacity={0} />
                            </mesh>

                            {/* path 타일은 아래 Suspense로 분리 렌더링 */}
                            {item === "tree" && (
                                <mesh position={[pos[0], 1, pos[2]]}>
                                    <cylinderGeometry args={[0.2, 0.3, 1.8, 12]} />
                                    <meshStandardMaterial color="#8b5a2b" />
                                    <mesh position={[0, 1.2, 0]}>
                                        <sphereGeometry args={[0.9, 16, 16]} />
                                        <meshStandardMaterial color="#5bb45b" />
                                    </mesh>
                                </mesh>
                            )}
                            {item === "fence" && (
                                <mesh position={pos}>
                                    <boxGeometry args={[1.5, 0.5, 0.2]} />
                                    <meshStandardMaterial color="#c69c6d" />
                                </mesh>
                            )}
                        </group>
                    );
                })
            )}

            {/* path 타일 렌더링: 텍스처 로딩만 서스펜드 */}
            <Suspense fallback={null}>
                <StoneTiles grid={grid} gridSize={gridSize} />
            </Suspense>
        </>
    );
}

function StoneTiles({ grid, gridSize }: { grid: (ItemType | null)[][]; gridSize: number }) {
    const CELL_SIZE = 2;
    const textures = useTexture({
        map: "/ground/Ground087_Color.jpg",
        normalMap: "/ground/Ground081Normal.jpg",
        roughnessMap: "/ground/Ground081_Roughness.jpg",
        aoMap: "/ground/Ground081_AO.jpg",
    });
    useMemo(() => {
        Object.values(textures).forEach((t: any) => {
            if (t) {
                t.wrapS = t.wrapT = THREE.RepeatWrapping;
                t.repeat.set(2, 2);
            }
        });
    }, [textures]);
    const material = useMemo(() => {
        return new THREE.MeshStandardMaterial({
            map: textures.map as any,
            normalMap: textures.normalMap as any,
            roughnessMap: textures.roughnessMap as any,
            aoMap: textures.aoMap as any,
            roughness: 0.8,
            metalness: 0.2,
            displacementScale: 0.03,
        });
    }, [textures]);

    return (
        <>
            {Array.from({ length: gridSize }).map((_, row) =>
                Array.from({ length: gridSize }).map((_, col) => {
                    const item = grid[row][col];
                    if (item !== "path") return null;
                    const pos: [number, number, number] = [
                        (col - gridSize / 2 + 0.5) * CELL_SIZE,
                        0.01,
                        (row - gridSize / 2 + 0.5) * CELL_SIZE,
                    ];
                    return <StoneTile key={`path-${row}-${col}`} position={pos} material={material} />;
                })
            )}
        </>
    );
}
