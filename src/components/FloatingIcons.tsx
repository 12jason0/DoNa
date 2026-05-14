"use client";

import { motion } from "framer-motion";

const CoffeeIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
        <line x1="6" x2="6" y1="2" y2="4" />
        <line x1="10" x2="10" y1="2" y2="4" />
        <line x1="14" x2="14" y1="2" y2="4" />
    </svg>
);
const ClapperboardIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M20.2 6 3 11l-.9-2.4L19.3 3z" />
        <path d="m9.7 7.3 2-5.4" />
        <path d="m15.6 5 2-5.4" />
        <path d="M4 11V21h16V11z" />
    </svg>
);
const HeartIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className}>
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
);
const WineIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M8 22h8" />
        <path d="M12 15v7" />
        <path d="M12 15a7.5 7.5 0 0 0 7.5-7.5V3h-15v4.5A7.5 7.5 0 0 0 12 15z" />
        <path d="M4.5 8h15" />
    </svg>
);

const ICONS = [
    { id: 1, Icon: CoffeeIcon,     wrapperSize: "w-16 h-16", iconSize: "w-7 h-7", top: "15%", left: "8%",  right: undefined, color: "text-amber-800" },
    { id: 2, Icon: ClapperboardIcon, wrapperSize: "w-14 h-14", iconSize: "w-6 h-6", top: "65%", left: "45%", right: undefined, color: "text-slate-700" },
    { id: 3, Icon: HeartIcon,       wrapperSize: "w-12 h-12", iconSize: "w-5 h-5", top: "20%", left: undefined, right: "10%", color: "text-rose-500" },
    { id: 4, Icon: WineIcon,        wrapperSize: "w-16 h-16", iconSize: "w-7 h-7", top: "75%", left: undefined, right: "8%",  color: "text-red-900" },
] as const;

export default function FloatingIcons() {
    return (
        <>
            {ICONS.map((item, index) => {
                const IconComponent = item.Icon;
                return (
                    <motion.div
                        key={item.id}
                        className={`absolute z-0 pointer-events-none ${item.wrapperSize}`}
                        style={{ top: item.top, left: item.left, right: item.right }}
                        animate={{ y: [0, -12, 0] }}
                        transition={{
                            duration: 4 + index * 0.5,
                            repeat: Infinity,
                            repeatType: "reverse",
                            ease: "easeInOut",
                        }}
                    >
                        <div className={`flex items-center justify-center rounded-full bg-white/70 shadow-lg backdrop-blur-md border border-white/40 w-full h-full ${item.color}`}>
                            <IconComponent className={item.iconSize} />
                        </div>
                    </motion.div>
                );
            })}
        </>
    );
}
