import { useCallback, useEffect, useState } from "react";

export function useLocalhost<T>(localstorage_id: string, default_value: T) {
    const [value, set_value_internal] = useState(default_value)
    useEffect(() => {
        set_value_internal(JSON.parse(localStorage.getItem(localstorage_id) ?? "null") ?? default_value)
    }, [set_value_internal, default_value, localstorage_id])
    const set_font = useCallback((new_value: T) => {
        localStorage.setItem(localstorage_id, JSON.stringify(new_value))
        set_value_internal(new_value)
    }, [set_value_internal, localstorage_id])
    return [value, set_font] satisfies [any, any]
}