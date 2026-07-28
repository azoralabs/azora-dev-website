import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { matchPath } from './router-core.js'

const LocationContext = createContext(null)
const ParamsContext = createContext({})

const currentUrl = () => `${window.location.pathname}${window.location.search}`

export function BrowserRouter({ children }) {
  const [url, setUrl] = useState(currentUrl)

  useEffect(() => {
    const handlePopState = () => setUrl(currentUrl())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((target, options = {}) => {
    const next = typeof target === 'number' ? target : String(target)
    if (typeof next === 'number') {
      window.history.go(next)
      return
    }
    const destination = new URL(next, window.location.origin)
    if (destination.origin !== window.location.origin) {
      window.location.assign(destination.href)
      return
    }
    const nextUrl = `${destination.pathname}${destination.search}${destination.hash}`
    window.history[options.replace ? 'replaceState' : 'pushState']({}, '', nextUrl)
    setUrl(currentUrl())
    if (!destination.hash) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  const value = useMemo(() => {
    const parsed = new URL(url, window.location.origin)
    return {
      pathname: parsed.pathname,
      search: parsed.search,
      navigate,
    }
  }, [navigate, url])

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useLocation() {
  const location = useContext(LocationContext)
  if (!location) throw new Error('useLocation must be used inside BrowserRouter')
  return location
}

export function useNavigate() {
  return useLocation().navigate
}

export function useSearchParams() {
  const { pathname, search, navigate } = useLocation()
  const params = useMemo(() => new URLSearchParams(search), [search])
  const setParams = useCallback((next) => {
    const value = typeof next === 'function' ? next(new URLSearchParams(search)) : next
    const serialized = new URLSearchParams(value).toString()
    navigate(serialized ? `${pathname}?${serialized}` : pathname)
  }, [navigate, pathname, search])
  return [params, setParams]
}

export function useParams() {
  return useContext(ParamsContext)
}

export function Link({ to, onClick, target, children, ...props }) {
  const navigate = useNavigate()
  const handleClick = (event) => {
    onClick?.(event)
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || target === '_blank'
    ) return
    event.preventDefault()
    navigate(to)
  }
  return <a href={to} target={target} onClick={handleClick} {...props}>{children}</a>
}

export function Route() {
  return null
}

export function Routes({ children }) {
  const { pathname } = useLocation()
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child) || child.type !== Route) continue
    const params = matchPath(child.props.path, pathname)
    if (params) {
      return <ParamsContext.Provider value={params}>{child.props.element}</ParamsContext.Provider>
    }
  }
  return null
}

export function Navigate({ to, replace = false }) {
  const navigate = useNavigate()
  useEffect(() => navigate(to, { replace }), [navigate, replace, to])
  return null
}
