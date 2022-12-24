#define DIFFUSE_SHADING_MODE 1

#include canvas:shaders/pipeline/diffuse.glsl
#include frex:shaders/api/context.glsl
#include frex:shaders/api/sampler.glsl
#include frex:shaders/api/vertex.glsl
#include frex:shaders/api/view.glsl
#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/hash.glsl

/* lomo:lomo.vert */

vec2 taa_offset() {
	// 0: -0.25, -0.25
	// 1:  0.25, -0.25
	// 2: -0.25,  0.25
	// 3:  0.25,  0.25
	uint i = frx_renderFrames;
	return (
		vec2(float(i % 2u), float((i / 2u) % 2u)) - 0.5
	) * 0.5;
}

void frx_pipelineVertex() {
	if (frx_isGui) {
		gl_Position = frx_guiViewProjectionMatrix * frx_vertex;
		frx_distance = length(gl_Position.xyz);
	} else {
		frx_vertex += frx_modelToCamera;
		vec4 viewCoord = frx_viewMatrix * frx_vertex;
		frx_distance = length(viewCoord.xyz);

		vec4 ndc0 = frx_projectionMatrix * viewCoord;
		vec3 ndc = ndc0.xyz / ndc0.w;
		vec3 win = vec3(ndc * 0.5 + 0.5);
		win.xy *= vec2(frx_viewWidth, frx_viewHeight);
		win.xy += taa_offset();
		win.xy /= vec2(frx_viewWidth, frx_viewHeight);
		gl_Position = vec4(win * 2.0 - 1.0, 1.0) * ndc0.w;
	}
	pv_diffuse = p_diffuse(frx_vertexNormal);
}