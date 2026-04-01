export declare const config: {
    port: number;
    jwtSecret: string;
    jwtExpiresIn: string;
    og: {
        rpc: string;
        chainId: number;
        indexer: string;
        flowContract: string;
        privateKey: string;
    };
    contract: {
        address: string;
    };
    compute: {
        baseUrl: string;
        authToken: string;
        model: string;
    };
    db: {
        path: string;
    };
    mediaCache: {
        dir: string;
        maxAgeSeconds: number;
    };
    upload: {
        maxPhotos: number;
        maxPhotoSizeMb: number;
    };
    routePrice: {
        base: string;
    };
};
//# sourceMappingURL=config.d.ts.map