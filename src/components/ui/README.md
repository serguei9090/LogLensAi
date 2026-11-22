# UI Primitives

## Overview
Base UI and Tailwind design-system primitive wrappers (`@base-ui/react`, `react-day-picker`, `sonner`, `class-variance-authority`) exposing accessible, composable building blocks across LogLensAi.

## Interface
- `[accordion.tsx:Accordion]` - Component wrapping `AccordionPrimitive.Root` (`AccordionPrimitive.Root.Props`).
- `[accordion.tsx:AccordionItem]` - Component wrapping `AccordionPrimitive.Item`.
- `[accordion.tsx:AccordionTrigger]` - Component wrapping `AccordionPrimitive.Header` and `AccordionPrimitive.Trigger`.
- `[accordion.tsx:AccordionContent]` - Component wrapping `AccordionPrimitive.Panel`.
- `[badge.tsx:badgeVariants]` - CVA variant config (`default | secondary | destructive | outline | ghost | link`).
- `[badge.tsx:Badge]` - Component using `useRender(defaultTagName='span')` and `mergeProps` with `badgeVariants`.
- `[button.tsx:buttonVariants]` - CVA variant config (`variant`: `default | outline | secondary | ghost | destructive | link`; `size`: `default | xs | sm | lg | xl | icon | icon-xs | icon-sm | icon-lg`).
- `[button.tsx:Button]` - Component wrapping `ButtonPrimitive` with `buttonVariants`.
- `[calendar.tsx:CalendarProps]` - Exported type alias `React.ComponentProps<typeof DayPicker>`.
- `[calendar.tsx:Calendar]` - Component wrapping `DayPicker` (`showOutsideDays=true`, `captionLayout='label'`).
- `[card.tsx:Card]` - Card container `div` supporting `size?: 'default' | 'sm'`.
- `[card.tsx:CardHeader]` - Card header `div`.
- `[card.tsx:CardTitle]` - Card title `div`.
- `[card.tsx:CardDescription]` - Card description `div`.
- `[card.tsx:CardAction]` - Card action slot `div`.
- `[card.tsx:CardContent]` - Card content `div`.
- `[card.tsx:CardFooter]` - Card footer `div`.
- `[checkbox.tsx:Checkbox]` - Component wrapping `CheckboxPrimitive.Root` and `Indicator`.
- `[dialog.tsx:Dialog]` - Component wrapping `DialogPrimitive.Root`.
- `[dialog.tsx:DialogPortal]` - Component wrapping `DialogPrimitive.Portal`.
- `[dialog.tsx:DialogOverlay]` - Component wrapping `DialogPrimitive.Backdrop`.
- `[dialog.tsx:DialogContent]` - Component wrapping `DialogPortal`, `DialogOverlay`, and `DialogPrimitive.Popup` (`showCloseButton=true`).
- `[dialog.tsx:DialogHeader]` - Dialog header `div`.
- `[dialog.tsx:DialogFooter]` - Dialog footer `div` (`showCloseButton=false`).
- `[dialog.tsx:DialogTitle]` - Component wrapping `DialogPrimitive.Title`.
- `[dialog.tsx:DialogDescription]` - Component wrapping `DialogPrimitive.Description`.
- `[dropdown-menu.tsx:DropdownMenu]` - Component wrapping `MenuPrimitive.Root`.
- `[dropdown-menu.tsx:DropdownMenuTrigger]` - Component wrapping `MenuPrimitive.Trigger`.
- `[dropdown-menu.tsx:DropdownMenuContent]` - Component wrapping `Portal`, `Positioner`, and `Popup` (`align='start'`, `alignOffset=0`, `side='bottom'`, `sideOffset=4`).
- `[dropdown-menu.tsx:DropdownMenuItem]` - Component wrapping `MenuPrimitive.Item` (`inset?: boolean`, `variant?: 'default' | 'destructive'`).
- `[dropdown-menu.tsx:DropdownMenuSub]` - Component wrapping `MenuPrimitive.SubmenuRoot`.
- `[dropdown-menu.tsx:DropdownMenuSubTrigger]` - Component wrapping `MenuPrimitive.SubmenuTrigger`.
- `[dropdown-menu.tsx:DropdownMenuSubContent]` - Component wrapping `DropdownMenuContent` (`align='start'`, `alignOffset=-3`, `side='right'`, `sideOffset=0`).
- `[input.tsx:Input]` - Component wrapping `InputPrimitive` (`@base-ui/react/input`).
- `[label.tsx:Label]` - Styled `<label>` component.
- `[popover.tsx:Popover]` - Component wrapping `PopoverPrimitive.Root`.
- `[popover.tsx:PopoverTrigger]` - Component wrapping `PopoverPrimitive.Trigger`.
- `[popover.tsx:PopoverContent]` - Component wrapping `Portal`, `Positioner`, and `Popup` (`align='center'`, `alignOffset=0`, `side='bottom'`, `sideOffset=4`).
- `[popover.tsx:PopoverHeader]` - Popover header `div`.
- `[popover.tsx:PopoverTitle]` - Component wrapping `PopoverPrimitive.Title`.
- `[popover.tsx:PopoverDescription]` - Component wrapping `PopoverPrimitive.Description`.
- `[progress.tsx:Progress]` - Component wrapping `ProgressPrimitive.Root` with embedded `ProgressTrack` and `ProgressIndicator`.
- `[progress.tsx:ProgressTrack]` - Component wrapping `ProgressPrimitive.Track`.
- `[progress.tsx:ProgressIndicator]` - Component wrapping `ProgressPrimitive.Indicator`.
- `[progress.tsx:ProgressLabel]` - Component wrapping `ProgressPrimitive.Label`.
- `[progress.tsx:ProgressValue]` - Component wrapping `ProgressPrimitive.Value`.
- `[scroll-area.tsx:ScrollArea]` - Component wrapping `ScrollAreaPrimitive.Root` with `Viewport`, `ScrollBar`, and `Corner`.
- `[scroll-area.tsx:ScrollBar]` - Component wrapping `ScrollAreaPrimitive.Scrollbar` and `Thumb` (`orientation='vertical'`).
- `[select.tsx:Select]` - Re-export of `SelectPrimitive.Root`.
- `[select.tsx:SelectValue]` - Component wrapping `SelectPrimitive.Value`.
- `[select.tsx:SelectTrigger]` - Component wrapping `SelectPrimitive.Trigger` (`size='default'`).
- `[select.tsx:SelectContent]` - Component wrapping `Portal`, `Positioner`, `Popup`, `List`, and scroll buttons (`side='bottom'`, `sideOffset=8`, `align='center'`, `alignOffset=0`, `alignItemWithTrigger=false`).
- `[select.tsx:SelectItem]` - Component wrapping `SelectPrimitive.Item`, `ItemText`, and `ItemIndicator`.
- `[select.tsx:SelectScrollUpButton]` - Component wrapping `SelectPrimitive.ScrollUpArrow`.
- `[select.tsx:SelectScrollDownButton]` - Component wrapping `SelectPrimitive.ScrollDownArrow`.
- `[separator.tsx:Separator]` - Component wrapping `SeparatorPrimitive` (`orientation='horizontal'`).
- `[skeleton.tsx:Skeleton]` - Pulsing placeholder `div`.
- `[sonner.tsx:Toaster]` - Component wrapping `Sonner` (`sonner`) reading `useTheme()` (`theme='system'`).
- `[switch.tsx:Switch]` - Component wrapping `SwitchPrimitive.Root` and `Thumb` (`size='default'`).
- `[table.tsx:Table]` - Scroll-wrapped `<table>`.
- `[table.tsx:TableHeader]` - Styled `<thead>`.
- `[table.tsx:TableBody]` - Styled `<tbody>`.
- `[table.tsx:TableFooter]` - Styled `<tfoot>`.
- `[table.tsx:TableRow]` - Styled `<tr>`.
- `[table.tsx:TableHead]` - Styled `<th>`.
- `[table.tsx:TableCell]` - Styled `<td>`.
- `[table.tsx:TableCaption]` - Styled `<caption>`.
- `[tabs.tsx:Tabs]` - Component wrapping `TabsPrimitive.Root` (`orientation='horizontal'`).
- `[tabs.tsx:tabsListVariants]` - CVA variant config (`variant: 'default' | 'line'`).
- `[tabs.tsx:TabsList]` - Component wrapping `TabsPrimitive.List`.
- `[tabs.tsx:TabsTrigger]` - Component wrapping `TabsPrimitive.Tab`.
- `[tabs.tsx:TabsContent]` - Component wrapping `TabsPrimitive.Panel`.
- `[textarea.tsx:Textarea]` - Styled `<textarea>`.
- `[tooltip.tsx:TooltipProvider]` - Component wrapping `TooltipPrimitive.Provider` (`delay=0`).
- `[tooltip.tsx:Tooltip]` - Component wrapping `TooltipPrimitive.Root`.
- `[tooltip.tsx:TooltipTrigger]` - Component wrapping `TooltipPrimitive.Trigger`.
- `[tooltip.tsx:TooltipContent]` - Component wrapping `Portal`, `Positioner`, `Popup`, and `Arrow` (`side='top'`, `sideOffset=4`, `align='center'`, `alignOffset=0`).

## Invariants
- `None`

## Side Effects
- `None`

## Verification
- Run: `bun test`
