import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NgtButtonModule, NgtPortletModule } from 'projects/ng-tailwind/src/public-api';
import { CodePreviewModule } from 'src/app/components/code-preview/code-preview.module';
import { NgtStylizableTemplateModule } from 'src/app/components/ngt-stylizable-template/ngt-stylizable-template.module';

import { NgtButtonPageComponent } from './ngt-button-page.component';

const routes: Routes = [
    {
        "path": '',
        "component": NgtButtonPageComponent
    }
];

@NgModule({
    declarations: [NgtButtonPageComponent],
    imports: [
        CommonModule,
        RouterModule.forChild(routes),
        CodePreviewModule,
        NgtPortletModule,
        NgtButtonModule,
        NgtStylizableTemplateModule
    ]
})
export class NgtButtonPageModule { }
