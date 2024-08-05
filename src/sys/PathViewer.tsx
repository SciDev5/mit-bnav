import { useEffect, useMemo, useRef, useState } from "react";
import { Path, Vec2 } from "./svg";

function PathLayer({
    paths,
    scale,
    path_class,
    sel,
}: {
    paths: Path[],
    scale: number,
    path_class?: string,
    sel?: { i: number, len: number, set_i?: (i: number) => void },
}) {
    return (<>{
        paths.map((v, i) => {
            const color = sel
                ? (i >= sel.i && i - sel.i < sel.len ? "#0f0" : "#fff")
                : "#00f"

            return (
                <path
                    d={v.stringify(scale)}
                    strokeWidth={2}
                    className={path_class}
                    stroke={v.filled ?? false ? "none" : color}
                    fill={v.filled ?? false ? color : "none"}
                    onClick={e => {
                        if (e.shiftKey) return
                        sel?.set_i?.(i)
                    }}
                    onMouseOver={e => {
                        if (!e.ctrlKey) return
                        sel?.set_i?.(i)
                    }}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    key={i}
                />
            )
        })
    }</>)
}

export function PathViewer({
    layers,
}: {
    layers: {
        paths: Path[],
        key: string,
        path_class?: string,
        sel?: { i: number, len: number, set_i?: (i: number) => void },
    }[],
}) {
    const [true_scale, set_true_scale] = useState(1)
    return (<Locator {...{ set_true_scale, true_scale }}>
        {layers.map(({ paths, key, path_class, sel }) => (
            <PathLayer {...{ paths, path_class, sel }} scale={true_scale} key={key} />
        ))}
    </Locator>)
}

export function Locator({
    children,
    true_scale,
    set_true_scale,
}: { children: JSX.Element[], true_scale: number, set_true_scale: (true_scale: number) => void }) {
    const [fast_scale, set_fast_scale] = useState(1)
    const [offset_x, set_offset_x] = useState(0)
    const [offset_y, set_offset_y] = useState(0)
    const prevpos = useMemo(() => ({ x: 0, y: 0 }), [])
    const curpos = useMemo(() => ({ x: 0, y: 0 }), [])

    useEffect(() => {
        if (fast_scale === 1) return
        const timeout_id = setTimeout(() => {
            set_true_scale(fast_scale * true_scale)
            set_fast_scale(1)
        }, 100)
        return () => clearTimeout(timeout_id)
    }, [fast_scale, true_scale, set_true_scale])

    const [down, set_down] = useState(false)
    return (<svg
        width={"100vw"}
        height={"calc(100vh - 2em)"}
        onMouseDown={e => {
            if (e.ctrlKey) return
            prevpos.x = e.clientX
            prevpos.y = e.clientY
            curpos.x = offset_x
            curpos.y = offset_y
            set_down(true)
        }}
        onMouseUp={() => set_down(false)}
        onMouseLeave={() => set_down(false)}
        onMouseMove={e => {
            if (!down) return
            const delta_x = e.clientX - prevpos.x
            const delta_y = e.clientY - prevpos.y
            prevpos.x = e.clientX
            prevpos.y = e.clientY
            curpos.x += delta_x
            curpos.y += delta_y
            set_offset_x(curpos.x)
            set_offset_y(curpos.y)
        }}
        onWheel={e => {
            const x = (e.clientX - offset_x) / fast_scale
            const y = (e.clientY - offset_y) / fast_scale
            const new_fast_scale = fast_scale * Math.exp(-e.deltaY / 1000)
            set_fast_scale(new_fast_scale)
            set_offset_x(e.clientX - x * new_fast_scale)
            set_offset_y(e.clientY - y * new_fast_scale)
        }}
    >
        <g
            transform={`matrix(${fast_scale},0,0,${fast_scale},${offset_x},${offset_y})`}
        >
            {children}
        </g>
    </svg>)
}
