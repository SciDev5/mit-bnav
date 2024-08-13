import { useEffect, useState } from "react"

export function CopyPasteJSON<T>({
    name,
    value,
    set_value,
    check,
}: {
    name: string,
    value: (() => T) | null, set_value: (v: T) => void,
    check: (v: any) => v is T,
}) {
    const [copied, set_copied] = useState(false)
    useEffect(() => {
        if (copied) {
            const req_id = setTimeout(() => {
                set_copied(false)
            }, 1000)
            return () => clearTimeout(req_id)
        }
    }, [copied])
    return (<>
        {value && <button onClick={() => {
            navigator.clipboard.writeText(JSON.stringify(value())).then(() => set_copied(true))
        }}>{copied ? "copied" : "copy"} {name} json</button>}
        {<button onClick={async () => {
            try {
                const json = JSON.parse(await navigator.clipboard.readText())
                if (!check(json)) throw "typecheck failed"
                set_value(json)
            } catch (e) {
                alert("invalid import json: " + e)
            }
        }}>paste {name} json</button>}
    </>)
}