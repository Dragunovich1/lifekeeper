import {
  Book,
  Heart,
  Home,
  Shield,
  User,
  Wrench,
  type LucideProps,
} from 'lucide-react'
import type { NavSection } from '../navigation'

type SectionKey = NavSection['key']
type SubSectionKey = NavSection['subSections'][number]['key']

interface SidebarProps {
  sections: NavSection[]
  activeSection: SectionKey | null
  activeSubSection: SubSectionKey
  onSectionChange: (key: SectionKey) => void
  onSubSectionChange: (sectionKey: SectionKey, subKey: SubSectionKey) => void
  visible?: boolean
}

const classNames = (...values: Array<string | false>) => values.filter(Boolean).join(' ')

const iconMap: Record<string, (props: LucideProps) => JSX.Element> = {
  User,
  Heart,
  Book,
  Shield,
  Home,
  Wrench,
}

export const Sidebar = ({
  sections,
  activeSection,
  activeSubSection,
  onSectionChange,
  onSubSectionChange,
  visible = true,
}: SidebarProps) => {
  return (
    <aside className={classNames('sidebar', visible ? 'visible' : 'hidden')}>
      <div className="sidebar-header">
        <span className="sidebar-title">Panel</span>
      </div>
      {sections.map((section) => {
        const Icon = iconMap[section.icon]
        return (
          <div key={section.key} className="sidebar-section">
            <button
              type="button"
              className={classNames('sidebar-section-button', activeSection === section.key && 'active')}
              onClick={() => onSectionChange(section.key)}
            >
              {Icon && <Icon className="sidebar-icon" aria-hidden />}
              <span className="sidebar-label">{section.label}</span>
            </button>
            <div className={classNames('sidebar-subsection-container', activeSection !== section.key && 'collapsed')}>
              {section.subSections.map((subSection) => (
                <button
                  key={subSection.key}
                  type="button"
                  className={classNames(
                    'sidebar-subsection-button',
                    activeSection === section.key && activeSubSection === subSection.key && 'active',
                  )}
                  onClick={() => onSubSectionChange(section.key, subSection.key)}
                >
                  {subSection.label}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </aside>
  )
}