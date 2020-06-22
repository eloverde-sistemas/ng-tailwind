import {
  Component,
  EventEmitter,
  Host,
  Injector,
  Input,
  OnInit,
  Optional,
  Output,
  SimpleChanges,
  SkipSelf,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { ControlContainer, NgForm, Validators } from '@angular/forms';
import { NgxDropzoneChangeEvent, NgxDropzoneComponent } from 'ngx-dropzone';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';

import { NgtBaseNgModel, NgtMakeProvider } from '../../base/ngt-base-ng-model';
import { getEnumFromString } from '../../helpers/enum/enum';
import { NgtAttachmentHttpService } from '../../services/http/ngt-attachment-http.service';
import { NgtStylizableService } from '../../services/ngt-stylizable/ngt-stylizable.service';
import { NgtFormComponent } from '../ngt-form/ngt-form.component';

@Component({
  selector: 'ngt-dropzone',
  templateUrl: './ngt-dropzone.component.html',
  styleUrls: ['./ngt-dropzone.component.css'],
  encapsulation: ViewEncapsulation.None,
  providers: [
    NgtMakeProvider(NgtDropzoneComponent),
  ],
  viewProviders: [
    { provide: ControlContainer, useExisting: NgForm }
  ]
})
export class NgtDropzoneComponent extends NgtBaseNgModel implements OnInit {
  @ViewChild('ngxDropzone', { static: true }) ngxDropzone: NgxDropzoneComponent;

  // Visual
  @Input() label: string;
  @Input() placeholder: string;
  @Input() helpTitle: string;
  @Input() helpTextColor: string = 'text-green-500';
  @Input() helpText: boolean = false;

  // Behavior
  @Input() multipleSelection: boolean = false;
  @Input() itemsLimit: number;
  @Input() showFileName: boolean = false;
  @Input() disableClick: boolean = false;
  @Input() disabled: boolean = false;
  @Input() removable: boolean = false;
  @Input() verticalExpandable: boolean = false;
  @Input() acceptedFiles: string = '*' /** Mime type */;
  @Input() maxFileSize: number; /** Bytes */
  @Input() previewType: NgtDropzonePreviewType = NgtDropzonePreviewType.DEFAULT;
  @Input() isRequired: boolean = false;
  @Input() name: string;
  @Input() remoteResource: any;

  @Output() onFileSelected: EventEmitter<NgxDropzoneChangeEvent> = new EventEmitter();
  @Output() onFileSelectError: EventEmitter<NgtDropzoneErrorType> = new EventEmitter();
  @Output() onFileUploadFail: EventEmitter<any> = new EventEmitter();
  @Output() onFileRemoved = new EventEmitter();
  @Output() onFileUploaded = new EventEmitter();
  @Output() onFilePreviewLoaded = new EventEmitter();

  public resources = [];
  public nativeValue = [];
  public shining: boolean;
  public componentReady = false;
  public loading: boolean = false;
  public ngtDropzoneLoaderStyle: NgtStylizableService;

  constructor(
    @Optional() @Host()
    public formContainer: ControlContainer,
    @Optional() @SkipSelf()
    private ngtFormComponent: NgtFormComponent,
    private ngtAttachmentHttpService: NgtAttachmentHttpService,
    private injector: Injector,
  ) {
    super();

    if (this.ngtFormComponent) {
      this.ngtFormComponent.onShiningChange.subscribe((shining: boolean) => {
        this.shining = shining;
      });
    }

    this.ngtDropzoneLoaderStyle = new NgtStylizableService();
    this.ngtDropzoneLoaderStyle.load(this.injector, 'NgtDropzoneLoader', {
      h: 'h-8',
      color: {
        text: 'text-gray-600'
      }
    });
  }

  public ngOnChanges(changes: SimpleChanges) {
    if (changes.previewType) {
      this.previewType = getEnumFromString(changes.previewType.currentValue, NgtDropzonePreviewType);
    }
  }

  public ngOnInit() {
    setTimeout(() => { }, 500);
    this.componentReady = true;

    setTimeout(() => {
      this.initComponent();
    });
  }

  public async onSelect(event: NgxDropzoneChangeEvent) {
    if (event.rejectedFiles.length) {
      for (const rejectedFile of <any>event.rejectedFiles) {
        if (rejectedFile.reason == 'size') {
          this.onFileSelectError.emit(NgtDropzoneErrorType.SIZE);
          break;
        } else if (rejectedFile.reason == 'no_multiple') {
          this.onFileSelectError.emit(NgtDropzoneErrorType.NO_MULTIPLE);
          break;
        } else if (rejectedFile.reason == 'type') {
          this.onFileSelectError.emit(NgtDropzoneErrorType.TYPE);
          break;
        } else {
          this.onFileSelectError.emit(NgtDropzoneErrorType.DEFAULT);
          break;
        }
      }
    }

    if (this.itemsLimit) {
      if (this.itemsLimit == 1 && event.addedFiles
        && event.addedFiles.length == this.itemsLimit && this.resources.length == this.itemsLimit) {
        this.resources = [];
      }

      if (event.addedFiles
        && event.addedFiles.length + this.resources.length <= this.itemsLimit) {
        this.onFileSelected.emit(event);
        this.uploadFiles(event.addedFiles);
      } else {
        this.onFileSelectError.emit(NgtDropzoneErrorType.ITEMS_LIMIT);
      }
    } else {
      this.onFileSelected.emit(event);
      this.uploadFiles(event.addedFiles);
    }
  }

  public async uploadFiles(files: Array<File>) {
    if (files && files.length) {
      let temporaryFiles = [];
      let temporaryAttachments = [];
      let observables = [];
      this.loading = true;

      files.forEach(file => {
        observables.push(this.ngtAttachmentHttpService.upload(this.remoteResource, file).pipe(
          map((response: any) => {
            if (response && response.data) {
              temporaryFiles.push({
                id: response.data.id,
                file: file
              });
              response.data['loaded'] = true;
              temporaryAttachments.push(response.data);
            }
          })
        ));
      });

      forkJoin(observables).subscribe(
        (response) => {
          this.resources.push(...temporaryFiles);

          if (this.itemsLimit == 1) {
            this.onNativeChange([...temporaryAttachments]);
          } else {
            this.onNativeChange([...temporaryAttachments, ...this.nativeValue]);
          }

          this.onFileUploaded.emit();
          this.loading = false;
        },
        (error) => {
          this.onFileUploadFail.emit(error);
          this.loading = false;
        });
    }
  }

  public async loadFilePreview(attachments: any) {
    if (attachments && attachments.length && attachments[0]) {
      let temporaryResource = [];
      let observables = [];

      attachments.forEach(attachment => {
        if (!(attachment instanceof File) && !attachment.loaded) {
          this.loading = true;
          attachment['loaded'] = true;
          observables.push(this.ngtAttachmentHttpService.preview(attachment).pipe(
            map((response: any) => {
              temporaryResource.push({
                id: response.data.getApiId(),
                file: response.data.getAttribute('file')
              });
            })
          )
          );
        }
      });

      forkJoin(observables).subscribe(
        (response) => {
          this.resources.push(...temporaryResource);
          this.onNativeChange(attachments);
          this.onFilePreviewLoaded.emit();
          this.loading = false;
        },
        (error) => {
          this.loading = false;
        });
    }
  }



  public onRemove(resource: any) {
    this.resources.splice(this.resources.indexOf(resource), 1);
    this.nativeValue = this.nativeValue.filter(element => element.id != resource.id);
    this.onNativeChange(this.nativeValue);
    this.onFileRemoved.emit(resource);
  }

  public onNativeChange(value: any) {
    if (value === undefined) {
      this.value = [];
      this.nativeValue = [];
    } else {
      this.nativeValue = value;

      if (JSON.stringify(this.value) != JSON.stringify(this.nativeValue)) {
        this.value = this.nativeValue;
      }
    }
  }

  public change(value: any) {
    if (value) {
      this.onNativeChange(Array.isArray(value) ? value : [value]);
      this.loadFilePreview(Array.isArray(value) ? value : [value]);
    }
  }

  public downloadFile(attachment: any) {
    this.ngtAttachmentHttpService.download(attachment).subscribe(() => { });
  }

  public reset() {
    this.resources = [];
    this.value = [];
    this.nativeValue = [];
    this.initComponent();
  }

  public openFileSelector() {
    if (this.ngxDropzone) {
      this.ngxDropzone.showFileSelector();
    }
  }

  private initComponent() {
    if (this.formContainer && this.formContainer.control
      && (this.formControl = this.formContainer.control.get(this.name))) {
      this.updateValidations();

      if (this.value) {
        this.formControl.markAsDirty();
      } else {
        this.formControl.markAsPristine();
      }
    }
  }

  private updateValidations() {
    if (!this.formControl) {
      return;
    }

    let syncValidators = [];

    if (this.isRequired) {
      syncValidators.push(Validators.required);
    }

    syncValidators.push()

    setTimeout(() => {
      this.formControl.setValidators(syncValidators);
      this.formControl.updateValueAndValidity();
    });
  }
}

export enum NgtDropzonePreviewType {
  DEFAULT = 'DEFAULT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO'
}

export enum NgtDropzoneErrorType {
  DEFAULT = 'DEFAULT',
  SIZE = 'SIZE',
  NO_MULTIPLE = 'NO_MULTIPLE',
  ITEMS_LIMIT = 'ITEMS_LIMIT',
  TYPE = 'TYPE'
}