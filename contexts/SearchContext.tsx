"use client"
import { createContext, useContext } from "react"

interface SearchCtx {
  openSearch: () => void
}

export const SearchContext = createContext<SearchCtx>({ openSearch: () => {} })

export const useSearch = () => useContext(SearchContext)
