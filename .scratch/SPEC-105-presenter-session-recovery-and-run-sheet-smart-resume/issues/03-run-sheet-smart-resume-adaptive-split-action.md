# 03: Run-Sheet Smart Resume Adaptive Split Action

**Satisfies:** [UC-5, FR-16, FR-17]
**Blocked by:** SPEC-105-02
**Status:** done

**What to build:** In `spa/src/pages/RunSheetPage.tsx` and `tests/run-sheet-smart-resume.test.mjs`:

1. **Fail-Closed Session Inspection**:
   - In `RunSheetPage.tsx`, inspect session state using `peekPresenterSession(svc.id, svc.plan_identity)`.
   - Update inspection state when the window regains focus (`window.addEventListener('focus', checkSession)`).
   - If `svc.plan_identity` does not match the saved session or if the session is expired, `peekPresenterSession` returns `{ hasSession: false }`.

2. **Adaptive Action UI**:
   - **Condition A (No Active Session / Expired / Slide 0 and Not Blank/Overlay)**:
     - Render standard prominent button:
       ```tsx
       <Link
         href={`/services/${svc.id}/present`}
         className={cn(buttonVariants({ variant: 'default' }), 'h-9 px-4 font-bold shadow-xs')}
       >
         {t('edit.actions.present')}
       </Link>
       ```
   - **Condition B (Active Session in Progress — `slideNumber > 1 || isBlank || hasScripture`)**:
     - Render Split Button utilizing existing `@/components/ui/dropdown-menu` components:
       ```tsx
       <div className="inline-flex rounded-md shadow-xs">
         <Link
           href={`/services/${svc.id}/present`}
           className={cn(
             buttonVariants({ variant: 'default' }),
             'rounded-r-none h-9 px-3.5 font-bold border-r border-primary-foreground/20'
           )}
           title={sessionInfo.isBlank ? 'Screen is blanked' : undefined}
         >
           Resume (Slide {sessionInfo.slideNumber})
         </Link>
         <DropdownMenu>
           <DropdownMenuTrigger
             aria-label="Presentation Launch Options"
             className={cn(
               buttonVariants({ variant: 'default' }),
               'rounded-l-none h-9 px-2 cursor-pointer'
             )}
           >
             <ChevronDown className="w-3.5 h-3.5" />
           </DropdownMenuTrigger>
           <DropdownMenuContent align="end" className="w-56">
             <DropdownMenuItem
               onClick={() => navigate(`/services/${svc.id}/present`)}
               className="cursor-pointer font-medium"
             >
               Resume (Slide {sessionInfo.slideNumber})
             </DropdownMenuItem>
             <DropdownMenuItem
               onClick={() => {
                 clearPresenterSession(svc.id);
                 navigate(`/services/${svc.id}/present`);
               }}
               className="cursor-pointer text-destructive focus:text-destructive"
             >
               Start from Beginning (Slide 1)
             </DropdownMenuItem>
           </DropdownMenuContent>
         </DropdownMenu>
       </div>
       ```

3. **URL Cleanliness Invariant**:
   - Both "Resume" and "Start from Beginning" navigate directly to `/services/${svc.id}/present` without query parameters (`?reset=1`), ensuring subsequent reloads on the presenter tab maintain position.

4. **Test Requirements (`tests/run-sheet-smart-resume.test.mjs`)**:
   - When no session is saved, renders single "Present" button.
   - When active session on slide 14 is saved with matching plan identity, renders "Resume (Slide 15)" button with dropdown.
   - When plan identity differs, renders standard "Present" button (fail-closed).
   - Clicking "Start from Beginning" clears `localStorage` and triggers navigation.
   - When session is expired (> 8h), renders standard "Present" button.
