#include canvas:shaders/pipeline/diffuse.glsl
#include frex:shaders/api/context.glsl
#include frex:shaders/api/sampler.glsl
#include frex:shaders/api/vertex.glsl
#include frex:shaders/api/view.glsl
#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/hash.glsl

// lomo:lomo.vert

void frx_pipelineVertex() {
	if (frx_isGui) {
		gl_Position = frx_guiViewProjectionMatrix * frx_vertex;
		frx_distance = length(gl_Position.xyz);
	} else {
		frx_vertex += frx_modelToCamera;
		vec4 viewCoord = frx_viewMatrix * frx_vertex;
		frx_distance = length(viewCoord.xyz);
		gl_Position = frx_projectionMatrix * viewCoord;

		/*vec4 ndc0 = frx_projectionMatrix * viewCoord;
		vec3 ndc = ndc0.xyz / ndc0.w;
		vec3 win = vec3(ndc * 0.5 + 0.5);
		win.xy *= vec2(frx_viewWidth, frx_viewHeight);
		win.xy += (hash23(uvec3(win.xy * 1000.0, frx_renderSeconds * 1000.0)) - 0.5) * 2.0;
		win.xy /= vec2(frx_viewWidth, frx_viewHeight);
		gl_Position = vec4(win * 2.0 - 1.0, 1.0) * ndc0.w;*/
	}
}