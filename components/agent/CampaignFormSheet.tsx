"use client";

import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useCampaignStore, Campaign } from "@/store/campaignStore";

const urlPattern = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|tiktok\.com|instagram\.com)/;

const schema = z.object({
  name: z.string().min(1, "Brand name required"),
  cpm: z.number().min(0),
  maxPerClip: z.number().min(0),
  minPayout: z.number().min(0),
  clipCount: z.number().min(1).max(10),
  clipLength: z.number(),
  aspectRatio: z.string(),
  aiInstructions: z.string(),
  contentRules: z.string(),
  scheduleEnabled: z.boolean(),
  scheduleFrequency: z.string().optional(),
  scheduleTime: z.string().optional(),
  sources: z.array(
    z.object({
      platform: z.string(),
      url: z.string().regex(urlPattern, "Must be a YouTube, TikTok, or Instagram URL"),
    })
  ).min(1, "Add at least one source URL"),
});

type FormValues = z.infer<typeof schema>;

const clipLengths = [30, 45, 60, 90, 120];
const aspectRatios = [
  { value: "9:16", label: "Vertical 9:16", w: 18, h: 32 },
  { value: "16:9", label: "Horizontal 16:9", w: 32, h: 18 },
  { value: "1:1", label: "Square 1:1", w: 24, h: 24 },
];

interface Props {
  open: boolean;
  onClose: () => void;
  editCampaign?: Campaign | null;
}

export default function CampaignFormSheet({ open, onClose, editCampaign }: Props) {
  const { addCampaign, updateCampaign } = useCampaignStore();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      cpm: 0,
      maxPerClip: 0,
      minPayout: 0,
      clipCount: 5,
      clipLength: 60,
      aspectRatio: "9:16",
      aiInstructions: "",
      contentRules: "",
      scheduleEnabled: false,
      scheduleFrequency: "daily",
      scheduleTime: "09:00",
      sources: [{ platform: "youtube", url: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "sources" });
  const scheduleEnabled = watch("scheduleEnabled");
  const clipLength = watch("clipLength");
  const aspectRatio = watch("aspectRatio");

  useEffect(() => {
    if (editCampaign) {
      reset({
        ...editCampaign,
        sources: editCampaign.sources.map((s) => ({ platform: s.platform, url: s.url })),
        scheduleFrequency: editCampaign.scheduleFrequency || "daily",
        scheduleTime: editCampaign.scheduleTime || "09:00",
      });
    } else {
      reset({
        name: "", cpm: 0, maxPerClip: 0, minPayout: 0, clipCount: 5, clipLength: 60,
        aspectRatio: "9:16", aiInstructions: "", contentRules: "", scheduleEnabled: false,
        scheduleFrequency: "daily", scheduleTime: "09:00",
        sources: [{ platform: "youtube", url: "" }],
      });
    }
  }, [editCampaign, reset, open]);

  const onSubmit = async (data: FormValues) => {
    try {
      const endpoint = editCampaign ? `/api/campaigns/${editCampaign.id}` : "/api/campaigns";
      const method = editCampaign ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const campaign = await res.json();
      if (!res.ok) throw new Error(campaign.error);

      if (editCampaign) {
        updateCampaign(editCampaign.id, campaign);
        toast.success("Campaign updated");
      } else {
        addCampaign(campaign);
        toast.success("Campaign created");
      }
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save campaign");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[480px] overflow-y-auto" side="right">
        <SheetHeader className="mb-6">
          <SheetTitle>{editCampaign ? "Edit Campaign" : "New Campaign Brief"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic info */}
          <div className="space-y-3">
            <div>
              <Label>Brand Name *</Label>
              <input
                {...register("name")}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C0392B]/30"
                placeholder="e.g. YoungLA"
              />
              {errors.name && <p className="text-[#C0392B] text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(["cpm", "maxPerClip", "minPayout"] as const).map((field) => (
                <div key={field}>
                  <Label className="capitalize">{field === "cpm" ? "CPM ($)" : field === "maxPerClip" ? "Max/Clip ($)" : "Min Payout ($)"}</Label>
                  <input
                    type="number"
                    step="0.01"
                    {...register(field, { valueAsNumber: true })}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C0392B]/30"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Sources */}
          <div>
            <h3 className="font-semibold text-sm text-[#111827] mb-2">Content Sources</h3>
            {fields.map((field, i) => (
              <div key={field.id} className="flex gap-2 mb-2">
                <select
                  {...register(`sources.${i}.platform`)}
                  className="px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
                >
                  <option value="youtube">YouTube</option>
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                </select>
                <input
                  {...register(`sources.${i}.url`)}
                  placeholder="https://..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C0392B]/30"
                />
                <button type="button" onClick={() => remove(i)} className="text-[#C0392B] hover:text-[#C0392B]/70 p-1">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {errors.sources && <p className="text-[#C0392B] text-xs mt-1">{errors.sources.message || errors.sources.root?.message}</p>}
            <button
              type="button"
              onClick={() => append({ platform: "youtube", url: "" })}
              className="text-sm text-[#6B7280] border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 flex items-center gap-1 mt-1"
            >
              <Plus size={14} /> Add Source URL
            </button>
          </div>

          {/* Clip settings */}
          <div>
            <h3 className="font-semibold text-sm text-[#111827] mb-3">Clip Settings</h3>
            <div className="mb-3">
              <Label>Clips per run (1-10)</Label>
              <input
                type="number"
                min={1} max={10}
                {...register("clipCount", { valueAsNumber: true })}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
              />
            </div>
            <div className="mb-3">
              <Label>Clip Length</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {clipLengths.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setValue("clipLength", l)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      clipLength === l
                        ? "bg-[#C0392B] text-white border-[#C0392B]"
                        : "border-gray-200 text-[#6B7280] hover:border-[#C0392B]/40"
                    }`}
                  >
                    {l < 60 ? `${l}s` : `${l / 60}min`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Aspect Ratio</Label>
              <div className="flex gap-3 mt-2">
                {aspectRatios.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setValue("aspectRatio", r.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 border rounded-lg transition-colors flex-1 ${
                      aspectRatio === r.value ? "border-[#C0392B] bg-[#C0392B]/5" : "border-gray-200 hover:border-[#C0392B]/30"
                    }`}
                  >
                    <div
                      className={`border-2 ${aspectRatio === r.value ? "border-[#C0392B]" : "border-gray-300"} rounded-sm`}
                      style={{ width: r.w, height: r.h }}
                    />
                    <span className="text-[11px] text-[#6B7280]">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* AI Instructions */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sm text-[#111827]">AI Instructions</h3>
              <button
                type="button"
                className="text-xs text-[#6B7280] hover:text-[#111827]"
                onClick={() => setValue("aiInstructions", "Find high energy moments where the brand clothing/logo is clearly visible. Prioritize funny reactions, impressive athletic moments, and hype content. Avoid slow, quiet, or off-brand segments.")}
              >
                Use default
              </button>
            </div>
            <Textarea
              {...register("aiInstructions")}
              rows={4}
              placeholder="Find high energy moments where the brand clothing/logo is clearly visible. Prioritize funny reactions, impressive athletic moments, and hype content. Avoid slow, quiet, or off-brand segments."
            />
          </div>

          {/* Content Rules */}
          <div>
            <h3 className="font-semibold text-sm text-[#111827] mb-1">Content Rules</h3>
            <Textarea
              {...register("contentRules")}
              rows={3}
              placeholder="No promotional language. No NSFW content. Logo must be visible in frame."
            />
          </div>

          {/* Schedule */}
          <div>
            <h3 className="font-semibold text-sm text-[#111827] mb-2">Schedule</h3>
            <div className="flex items-center gap-3 mb-3">
              <Switch
                checked={scheduleEnabled}
                onCheckedChange={(v) => setValue("scheduleEnabled", v)}
              />
              <span className="text-sm text-[#6B7280]">Enable auto-run</span>
            </div>
            {scheduleEnabled && (
              <div className="space-y-2 pl-1">
                <div>
                  <Label>Frequency</Label>
                  <select
                    {...register("scheduleFrequency")}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
                  >
                    <option value="hourly">Every hour</option>
                    <option value="every6h">Every 6 hours</option>
                    <option value="every12h">Every 12 hours</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <div>
                  <Label>Time</Label>
                  <input
                    type="time"
                    {...register("scheduleTime")}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full bg-[#C0392B] hover:bg-[#C0392B]/90 text-white">
            {isSubmitting ? "Saving..." : "Save Campaign"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
