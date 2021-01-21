#include canvas:shaders/pipeline/diffuse.glsl
#include canvas:shaders/pipeline/varying.glsl

/******************************************************
  canvas:shaders/pipeline/standard.vert
******************************************************/

void frx_writePipelineVertex(in frx_VertexData data) {
	if (frx_modelOriginType() == MODEL_ORIGIN_SCREEN) {
		vec4 viewCoord = gl_ModelViewMatrix * data.vertex;
		gl_ClipVertex = viewCoord;
		gl_FogFragCoord = length(viewCoord.xyz);
		gl_Position = gl_ProjectionMatrix * viewCoord;
	} else {
		data.vertex += frx_modelToCamera();
		vec4 viewCoord = frx_viewMatrix() * data.vertex;
		gl_ClipVertex = viewCoord;
		gl_FogFragCoord = length(viewCoord.xyz);
		gl_Position = frx_projectionMatrix() * viewCoord;
	}

#ifdef VANILLA_LIGHTING
	pv_lightcoord = data.light;
	pv_ao = data.aoShade;
#endif

#if DIFFUSE_SHADING_MODE != DIFFUSE_MODE_NONE
	pv_diffuse = p_diffuse(data.normal);
#endif
}
