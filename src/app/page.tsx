'use client';

import Image from "next/image";
import styles from "./page.module.css";
import { useEffect, useRef, useState } from "react";
import { APath, DPath, Font, load_svg, Vec2 } from "@/sys/svg";

const r: Record<string, any> = {}
const remaining = new Set("qwertyuiopasdfghjklzxcvbnm1234567890/")

export default function Home() {
    const [p, set_p] = useState<DPath[]>([])
    const [q, set_q] = useState<DPath[]>([])
    const [sel_i, set_sel_i] = useState(0)
    const [sel_q, set_sel_q] = useState(0)

    useEffect(() => {
        const l = Font.DEFAULT.find_letters(p.flatMap(v => APath.from_d(v)), 0.1)
        const w = Font.DEFAULT.wordify(l, 0.1)
        console.log(l, w);
        // set_q(l.map(({ ch, bb }) => DPath.parse(`m ${bb.pos.x} ${bb.pos.y} h ${bb.dim.x} v ${bb.dim.y} h -${bb.dim.x} z`, {}, "LETTER " + ch)))
        set_q(w.map(({ str, bb }) => DPath.parse(`m ${bb.pos.x} ${bb.pos.y} h ${bb.dim.x} v ${bb.dim.y} h -${bb.dim.x} z`, {}, "LETTER " + str.map(v => v.ch).join(""))))
    }, [p])

    return (
        <>
            <input type={"file"} onChange={async e => {
                const d = await (e.currentTarget.files ?? [])[0]?.text()
                if (d == null) {
                    return
                }

                const svg = load_svg(d)
                if (svg == null) {
                    return
                }

                const z = svg.querySelectorAll("path")
                const s = [...z].map(v => DPath.parse(v.getAttribute("d")!, { filled: v.style.fill != "none" }, v.id))
                // s.forEach(v => v.scale(new Vec2(0.1, -0.1)).offset(new Vec2(0, 700)))
                s.forEach(v => v.scale(new Vec2(0.1, 0.1)))

                set_p(s)

            }} />
            <button onClick={() => {
                p.forEach(v => v.swap_xy())
                set_p([...p])
            }}>flip_xy</button>
            <button onClick={() => {
                p.forEach(v => v.scale(new Vec2(1, -1)).offset(new Vec2(0, 700)))
                set_p([...p])
            }}>flip_y</button>
            <button onClick={() => {
                p.forEach(v => v.scale(new Vec2(-1, 1)).offset(new Vec2(700, 0)))
                set_p([...p])
            }}>flip_x</button>
            <button onClick={() => {
                p.splice(sel_i, sel_q)
                set_p([...p])
            }}>delete</button>
            <button onClick={() => {
                const gen = APath.conormalize(p.slice(sel_i, sel_i + sel_q).flatMap(v => APath.from_d(v))).map(v => [v.points.map(({ x, y }) => [x, y]), v.loop])
                const ch = prompt("what letter")
                if (ch == null) {
                    return
                }
                remaining.delete(ch)

                r[ch] = gen
                console.log(remaining);
                console.log(ch, gen);
            }}>export</button>
            <button onClick={() => { console.log(r) }}>all exports</button>
            <input value={sel_q} type="number" min={0} max={p.length} step={1} onChange={e => { set_sel_q(e.currentTarget.valueAsNumber) }} />
            <svg width={"10000"} height={"10000"} style={{ background: "#000" }} >
                {
                    [...p, ...q].map((v, i) => {
                        const color = i >= sel_i && i - sel_i < sel_q ? "#0f0" : "#fff"

                        return (
                            <path
                                d={v.stringify()}
                                strokeWidth={0.5}
                                className={v.id}
                                stroke={v.style.filled ?? false ? "transparent" : color}
                                fill={v.style.filled ?? false ? color : "transparent"}
                                key={i}
                                onClick={() => set_sel_i(i)}
                            />
                        )
                    })
                }
            </svg>
        </>
    );
}
