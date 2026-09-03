import { useI18n } from "@/lib/i18n";
import { GRADES, LEVELS, LEVEL_LABEL, MAJORS, SECTIONS, needsMajor, type ClassValue, type Level } from "@/lib/classes";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ClassPicker({ value, onChange }: { value: ClassValue; onChange: (v: ClassValue) => void }) {
  const { t, lang } = useI18n();
  const grades = value.level ? GRADES[value.level] : [];
  const showGrade = value.level && value.level !== "KB";
  const showMajor = needsMajor(value);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="col-span-2 space-y-1 sm:col-span-1">
          <Label className="text-xs text-muted-foreground">{t("class.level")}</Label>
          <Select
            value={value.level || undefined}
            onValueChange={(v) => onChange({ level: v as Level, grade: "", section: "", major: "" })}
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {LEVEL_LABEL[lang][l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {showGrade && (
          <>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("class.grade")}</Label>
              <Select value={value.grade || undefined} onValueChange={(v) => onChange({ ...value, grade: v, major: "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {grades.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("class.section")}</Label>
              <Select value={value.section || undefined} onValueChange={(v) => onChange({ ...value, section: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      .{s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
      {showMajor && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("class.major")}</Label>
          <Select value={value.major || undefined} onValueChange={(v) => onChange({ ...value, major: v })}>
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {MAJORS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
