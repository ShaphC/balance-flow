import {Dock} from "@/components/navigation/dock";
export function AppShell({children}:{children:React.ReactNode}){return <div className="min-h-screen pb-24">{children}<Dock/></div>}
